import { NextRequest, NextResponse } from 'next/server';
import { ensureTenantContext } from '@/lib/tenantContext';
import { withErrorHandler, createSuccessResponse } from '@/lib/errorHandling';
import { validateRequestBody } from '@/lib/validation';
import {
  ticketPurchaseSchema,
  paymentInfoSchema
} from '@/lib/validation';
import { createAdminClient } from '@/utils/supabase/admin';
import { generateTicketQRCode } from '@/lib/qrService';
import {
  createPayment,
  generateMerchantReference,
  formatOrderItems,
  mapTripayStatus,
  getPaymentChannels
} from '@/lib/tripayService';
import { generateAndUploadTicketPDF } from '@/lib/pdfService';
import { randomUUID } from 'crypto';

// POST /api/[tenantId]/tickets/purchase - Purchase tickets
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Get tenant context from middleware
  const tenantContext = await ensureTenantContext(request);
  const supabase = createAdminClient();

  // Validate request body
  const body = await request.json();
  const validatedData = validateRequestBody(body, ticketPurchaseSchema);
  const paymentInfo = validateRequestBody(body.paymentInfo || {}, paymentInfoSchema);

  const { eventId, userId, user: userData, quantity } = validatedData;

  try {
    // Start transaction-like operations
    // 1. Get event details
    const { data: event, error: eventError } = await supabase
      .schema(tenantContext.schema)
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Check if event has enough tickets available
    if (event.max_tickets && event.sold_tickets + quantity > event.max_tickets) {
      return NextResponse.json(
        { error: 'Not enough tickets available' },
        { status: 400 }
      );
    }

    // 2. Get or create user
    let finalUserId = userId;
    if (!userId && userData) {
      const { data: newUser, error: userError } = await supabase
        .schema(tenantContext.schema)
        .from('users')
        .insert([userData])
        .select()
        .single();

      if (userError) {
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        );
      }
      finalUserId = newUser.id;
    } else if (!userId) {
      return NextResponse.json(
        { error: 'User ID or user data is required' },
        { status: 400 }
      );
    }

    // 3. Verify user exists
    const { data: existingUser, error: userCheckError } = await supabase
      .schema(tenantContext.schema)
      .from('users')
      .select('*')
      .eq('id', finalUserId)
      .single();

    if (userCheckError || !existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 4. Process payment
    let paymentStatus = 'pending';
    let paymentId = null;
    let gatewayResponse = null;

    if (paymentInfo.method === 'tripay') {
      // Create Tripay payment
      const merchantRef = generateMerchantReference(tenantContext.slug, eventId);

      const tripayRequest = {
        method: paymentInfo.tripayReference || 'BCAVA', // Default to BCA Virtual Account
        merchant_ref: merchantRef,
        amount: event.price * quantity,
        customer_name: existingUser.name || existingUser.email,
        customer_email: existingUser.email,
        customer_phone: existingUser.phone || '',
        order_items: formatOrderItems([{
          id: event.id,
          eventName: event.title,
          price: event.price,
          quantity: quantity,
        }]),
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/tripay`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
        expired_time: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
      };

      const tripayResponse = await createPayment(tripayRequest);

      if (tripayResponse.success && tripayResponse.data) {
        paymentStatus = mapTripayStatus(tripayResponse.data.status);
        paymentId = tripayResponse.data.reference;
        gatewayResponse = tripayResponse.data;
      } else {
        return NextResponse.json(
          { error: 'Failed to create payment' },
          { status: 500 }
        );
      }
    } else {
      // For non-Tripay payments, mark as success for demo
      paymentStatus = 'success';
      paymentId = randomUUID();
    }

    // 5. Create tickets
    const tickets = [];
    for (let i = 0; i < quantity; i++) {
      // Generate QR code for each ticket
      const qrCodeDataURL = await generateTicketQRCode(
        randomUUID(),
        tenantContext.slug,
        eventId,
        finalUserId
      );

      // Generate QR code string (stored in database)
      const qrString = `TICKET_${tenantContext.slug}_${randomUUID().replace(/-/g, '').substring(0, 16).toUpperCase()}`;

      // Create ticket record
      const { data: ticket, error: ticketError } = await supabase
        .schema(tenantContext.schema)
        .from('tickets')
        .insert([{
          event_id: eventId,
          user_id: finalUserId,
          qr_code: qrString,
          status: paymentStatus === 'success' ? 'valid' : 'pending',
          payment_id: paymentId,
        }])
        .select()
        .single();

      if (ticketError) {
        throw new Error(`Failed to create ticket: ${ticketError.message}`);
      }

      tickets.push({
        ...ticket,
        qrCodeDataURL,
      });
    }

    // 6. Create payment record
    const { data: payment, error: paymentError } = await supabase
      .schema(tenantContext.schema)
      .from('payments')
      .insert([{
        ticket_id: tickets[0].id, // Link to first ticket
        amount: event.price * quantity,
        method: paymentInfo.method,
        status: paymentStatus,
        gateway_response: gatewayResponse,
      }])
      .select()
      .single();

    if (paymentError) {
      throw new Error(`Failed to create payment record: ${paymentError.message}`);
    }

    // 7. Update event sold tickets count
    const { error: updateError } = await supabase
      .schema(tenantContext.schema)
      .from('events')
      .update({ sold_tickets: event.sold_tickets + quantity })
      .eq('id', eventId);

    if (updateError) {
      console.error('Error updating event sold tickets:', updateError);
    }

    // 8. Generate PDF tickets if payment is successful
    let pdfUrls = [];
    if (paymentStatus === 'success') {
      for (const ticket of tickets) {
        const pdfUrl = await generateAndUploadTicketPDF({
          ticket,
          event,
          user: existingUser,
          tenantName: tenantContext.slug,
          qrCodeDataURL: ticket.qrCodeDataURL,
        });
        pdfUrls.push(pdfUrl);
      }
    }

    // 9. Return response
    const responseData = {
      tickets: tickets.map((ticket, index) => ({
        id: ticket.id,
        qrCode: ticket.qr_code,
        status: ticket.status,
        pdfUrl: pdfUrls[index] || null,
      })),
      payment: {
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        status: payment.status,
        tripayData: gatewayResponse,
      },
      event: {
        id: event.id,
        title: event.title,
        date: event.date,
        venue: event.venue,
      },
      user: {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
      },
    };

    return createSuccessResponse(
      responseData,
      'Tickets purchased successfully',
      201
    );

  } catch (error) {
    console.error('Ticket purchase error:', error);
    return NextResponse.json(
      { error: 'Failed to purchase tickets' },
      { status: 500 }
    );
  }
});

// GET /api/[tenantId]/tickets/purchase/channels - Get available payment channels
export const GET = withErrorHandler(async (request: NextRequest) => {
  try {
    const channels = await getPaymentChannels();
    return createSuccessResponse(channels);
  } catch (error) {
    console.error('Error fetching payment channels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment channels' },
      { status: 500 }
    );
  }
});