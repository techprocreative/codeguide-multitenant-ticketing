import { NextRequest, NextResponse } from 'next/server';
import { ensureTenantContext } from '@/lib/tenantContext';
import { withErrorHandler, createSuccessResponse, NotFoundError, ValidationError } from '@/lib/errorHandling';
import { validateRequestBody } from '@/lib/validation';
import { ticketValidationSchema } from '@/lib/validation';
import { createAdminClient } from '@/utils/supabase/admin';
import { parseQRCodeData, validateQRCodeFormat } from '@/lib/qrService';
import { randomUUID } from 'crypto';

// POST /api/[tenantId]/tickets/[ticketId]/validate - Validate a ticket
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { tenantId: string, ticketId: string } }
) => {
  // Get tenant context from middleware
  const tenantContext = await ensureTenantContext(request);
  const { ticketId } = params;
  const supabase = createAdminClient();

  // Validate request body
  const body = await request.json();
  const validatedData = validateRequestBody(body, ticketValidationSchema);
  const { scanData, gateId } = validatedData;

  try {
    // 1. Find the ticket
    const { data: ticket, error: ticketError } = await supabase
      .schema(tenantContext.schema)
      .from('tickets')
      .select(`
        *,
        events:event_id (
          id,
          title,
          date,
          venue
        ),
        users:user_id (
          id,
          name,
          email
        )
      `)
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      await logGateScan(
        supabase,
        tenantContext.schema,
        ticketId,
        gateId,
        'invalid',
        scanData,
        'Ticket not found'
      );

      throw new NotFoundError('Ticket not found');
    }

    // 2. Validate QR code if provided
    let qrValidationResult = null;
    if (scanData) {
      if (!validateQRCodeFormat(scanData)) {
        await logGateScan(
          supabase,
          tenantContext.schema,
          ticketId,
          gateId,
          'invalid',
          scanData,
          'Invalid QR code format'
        );

        return createSuccessResponse({
          valid: false,
          ticket: null,
          reason: 'Invalid QR code format'
        });
      }

      qrValidationResult = parseQRCodeData(scanData);
      if (!qrValidationResult) {
        await logGateScan(
          supabase,
          tenantContext.schema,
          ticketId,
          gateId,
          'invalid',
          scanData,
          'Invalid QR code data or signature'
        );

        return createSuccessResponse({
          valid: false,
          ticket: null,
          reason: 'Invalid QR code data'
        });
      }

      // Verify QR code matches the ticket
      if (qrValidationResult.ticketId !== ticketId) {
        await logGateScan(
          supabase,
          tenantContext.schema,
          ticketId,
          gateId,
          'invalid',
          scanData,
          'QR code does not match ticket'
        );

        return createSuccessResponse({
          valid: false,
          ticket: null,
          reason: 'QR code does not match ticket'
        });
      }
    }

    // 3. Check ticket status
    if (ticket.status === 'used') {
      await logGateScan(
        supabase,
        tenantContext.schema,
        ticketId,
        gateId,
        'duplicate',
        scanData,
        'Ticket already used',
        ticket.used_at
      );

      return createSuccessResponse({
        valid: false,
        ticket: {
          id: ticket.id,
          status: ticket.status,
          event: ticket.events,
          user: ticket.users,
          usedAt: ticket.used_at,
        },
        reason: 'Ticket already used'
      });
    }

    if (ticket.status === 'cancelled') {
      await logGateScan(
        supabase,
        tenantContext.schema,
        ticketId,
        gateId,
        'invalid',
        scanData,
        'Ticket cancelled'
      );

      return createSuccessResponse({
        valid: false,
        ticket: {
          id: ticket.id,
          status: ticket.status,
        },
        reason: 'Ticket cancelled'
      });
    }

    if (ticket.status === 'expired') {
      await logGateScan(
        supabase,
        tenantContext.schema,
        ticketId,
        gateId,
        'invalid',
        scanData,
        'Ticket expired'
      );

      return createSuccessResponse({
        valid: false,
        ticket: {
          id: ticket.id,
          status: ticket.status,
        },
        reason: 'Ticket expired'
      });
    }

    if (ticket.status !== 'valid' && ticket.status !== 'pending') {
      await logGateScan(
        supabase,
        tenantContext.schema,
        ticketId,
        gateId,
        'invalid',
        scanData,
        `Invalid ticket status: ${ticket.status}`
      );

      return createSuccessResponse({
        valid: false,
        ticket: {
          id: ticket.id,
          status: ticket.status,
        },
        reason: 'Invalid ticket status'
      });
    }

    // 4. Check if event is still valid
    if (ticket.events && ticket.events.date) {
      const eventDate = new Date(ticket.events.date);
      const now = new Date();

      // Allow entry 2 hours before event and up to 4 hours after event
      const twoHoursBefore = new Date(eventDate.getTime() - 2 * 60 * 60 * 1000);
      const fourHoursAfter = new Date(eventDate.getTime() + 4 * 60 * 60 * 1000);

      if (now < twoHoursBefore) {
        await logGateScan(
          supabase,
          tenantContext.schema,
          ticketId,
          gateId,
          'invalid',
          scanData,
          'Event not started yet'
        );

        return createSuccessResponse({
          valid: false,
          ticket: {
            id: ticket.id,
            event: ticket.events,
          },
          reason: 'Event not started yet'
        });
      }

      if (now > fourHoursAfter) {
        await logGateScan(
          supabase,
          tenantContext.schema,
          ticketId,
          gateId,
          'invalid',
          scanData,
          'Event already ended'
        );

        return createSuccessResponse({
          valid: false,
          ticket: {
            id: ticket.id,
            event: ticket.events,
          },
          reason: 'Event already ended'
        });
      }
    }

    // 5. Validate the ticket (mark as used)
    const { error: updateError } = await supabase
      .schema(tenantContext.schema)
      .from('tickets')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        gate_entry_id: gateId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .eq('status', 'valid'); // Prevent race conditions

    if (updateError) {
      console.error('Error updating ticket status:', updateError);

      await logGateScan(
        supabase,
        tenantContext.schema,
        ticketId,
        gateId,
        'failed',
        scanData,
        'Failed to update ticket status'
      );

      return createSuccessResponse({
        valid: false,
        ticket: null,
        reason: 'System error during validation'
      });
    }

    // 6. Log successful gate entry
    await logGateScan(
      supabase,
      tenantContext.schema,
      ticketId,
      gateId,
      'success',
      scanData
    );

    // 7. Return success response
    return createSuccessResponse({
      valid: true,
      ticket: {
        id: ticket.id,
        event: ticket.events,
        user: ticket.users,
        validatedAt: new Date().toISOString(),
        gateId,
      },
      message: 'Ticket validated successfully'
    });

  } catch (error) {
    console.error('Ticket validation error:', error);

    // Try to log the error if we have the necessary information
    try {
      await logGateScan(
        supabase,
        tenantContext.schema,
        ticketId,
        gateId,
        'failed',
        scanData,
        'System error during validation'
      );
    } catch (logError) {
      console.error('Failed to log validation error:', logError);
    }

    throw error;
  }
});

// GET /api/[tenantId]/tickets/[ticketId]/validate - Get ticket validation status
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { tenantId: string, ticketId: string } }
) => {
  // Get tenant context from middleware
  const tenantContext = await ensureTenantContext(request);
  const { ticketId } = params;
  const supabase = createAdminClient();

  // Get ticket details
  const { data: ticket, error: ticketError } = await supabase
    .schema(tenantContext.schema)
    .from('tickets')
    .select(`
      *,
      events:event_id (
        id,
        title,
        date,
        venue
      ),
      users:user_id (
        id,
        name,
        email
      ),
      gate_logs:ticket_id (
        scan_time,
        gate_id,
        scan_result,
        error_message
      )
    `)
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    throw new NotFoundError('Ticket not found');
  }

  // Get recent gate logs
  const { data: gateLogs, error: logsError } = await supabase
    .schema(tenantContext.schema)
    .from('gate_logs')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('scan_time', { ascending: false })
    .limit(10);

  return createSuccessResponse({
    ticket: {
      id: ticket.id,
      status: ticket.status,
      event: ticket.events,
      user: ticket.users,
      purchasedAt: ticket.purchased_at,
      usedAt: ticket.used_at,
      gateEntryId: ticket.gate_entry_id,
    },
    gateLogs: gateLogs || [],
  });
});

/**
 * Log gate scan attempt
 */
async function logGateScan(
  supabase: any,
  schema: string,
  ticketId: string,
  gateId: string,
  scanResult: 'success' | 'failed' | 'duplicate' | 'invalid',
  scanData?: any,
  errorMessage?: string,
  usedAt?: string
): Promise<void> {
  try {
    const logData = {
      ticket_id: ticketId,
      gate_id: gateId,
      scan_result: scanResult,
      scan_data: scanData || {},
      error_message: errorMessage || null,
    };

    const { error: logError } = await supabase
      .schema(schema)
      .from('gate_logs')
      .insert([logData]);

    if (logError) {
      console.error('Error logging gate scan:', logError);
    }
  } catch (error) {
    console.error('Failed to log gate scan:', error);
  }
}