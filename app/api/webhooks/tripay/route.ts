import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { verifyCallbackSignature, mapTripayStatus } from '@/lib/tripayService';
import { withErrorHandler } from '@/lib/errorHandling';
import crypto from 'crypto';

// POST /api/webhooks/tripay - Handle Tripay payment callbacks
export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    // Get the raw request body
    const rawBody = await request.text();
    const signature = request.headers.get('x-callback-signature') || '';

    // Verify the signature
    if (!verifyCallbackSignature(rawBody, signature)) {
      console.error('Invalid Tripay webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse the callback data
    const callbackData = JSON.parse(rawBody);

    // Validate required fields
    if (!callbackData.reference || !callbackData.status) {
      console.error('Missing required fields in Tripay callback');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Find the payment record across all tenant schemas
    // This is a simplified approach - in production, you might want to
    // maintain a mapping table for faster lookups
    const paymentReference = callbackData.reference;

    // Get all tenants to search through their schemas
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('slug');

    if (tenantsError || !tenants) {
      console.error('Error fetching tenants:', tenantsError);
      return NextResponse.json(
        { error: 'Failed to process callback' },
        { status: 500 }
      );
    }

    let paymentUpdated = false;

    // Search through each tenant schema for the payment
    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.slug}`;

      try {
        // Find payment by reference in gateway_response
        const { data: payments, error: paymentError } = await supabase
          .schema(schemaName)
          .from('payments')
          .select('*')
          .like('gateway_response', `%${paymentReference}%`);

        if (paymentError) {
          console.error(`Error searching payments in schema ${schemaName}:`, paymentError);
          continue;
        }

        if (payments && payments.length > 0) {
          const payment = payments[0];
          const newStatus = mapTripayStatus(callbackData.status);

          // Update payment status
          const { error: updateError } = await supabase
            .schema(schemaName)
            .from('payments')
            .update({
              status: newStatus,
              gateway_response: callbackData,
              updated_at: new Date().toISOString(),
            })
            .eq('id', payment.id);

          if (updateError) {
            console.error(`Error updating payment in schema ${schemaName}:`, updateError);
            continue;
          }

          // If payment is successful, update associated tickets
          if (newStatus === 'success') {
            const { error: ticketUpdateError } = await supabase
              .schema(schemaName)
              .from('tickets')
              .update({
                status: 'valid',
                updated_at: new Date().toISOString(),
              })
              .eq('payment_id', payment.id)
              .eq('status', 'pending');

            if (ticketUpdateError) {
              console.error(`Error updating tickets in schema ${schemaName}:`, ticketUpdateError);
            }
          }

          paymentUpdated = true;
          console.log(`Payment ${payment.id} updated to status: ${newStatus}`);

          // We found and updated the payment, no need to search further
          break;
        }
      } catch (schemaError) {
        console.error(`Error processing schema ${schemaName}:`, schemaError);
        continue;
      }
    }

    if (!paymentUpdated) {
      console.error(`Payment with reference ${paymentReference} not found`);
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Tripay webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
});

// GET /api/webhooks/tripay - Test webhook endpoint
export async function GET() {
  return NextResponse.json({
    message: 'Tripay webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}