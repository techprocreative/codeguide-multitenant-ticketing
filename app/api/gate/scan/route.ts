import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, createSuccessResponse, ValidationError, UnauthorizedError } from '@/lib/errorHandling';
import { validateRequestBody } from '@/lib/validation';
import { z } from 'zod';
import { createAdminClient } from '@/utils/supabase/admin';
import crypto from 'crypto';

// Gate service request schema
const gateScanRequestSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  ticketId: z.string().uuid('Invalid ticket ID format'),
  scanData: z.string().min(1, 'Scan data is required'),
  gateId: z.string().min(1, 'Gate ID is required'),
  timestamp: z.number().int().optional(),
  deviceInfo: z.object({
    deviceId: z.string(),
    location: z.string().optional(),
    version: z.string().optional(),
  }).optional(),
});

// HMAC signature validation
function validateHMACSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

// Extract tenant from request or find it
async function findTenantForTicket(supabase: any, ticketId: string): Promise<string | null> {
  // Get all tenants and search for the ticket in their schemas
  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('slug');

  if (tenantsError || !tenants) {
    return null;
  }

  for (const tenant of tenants) {
    const schemaName = `tenant_${tenant.slug}`;

    try {
      const { data: ticket, error: ticketError } = await supabase
        .schema(schemaName)
        .from('tickets')
        .select('id')
        .eq('id', ticketId)
        .single();

      if (!ticketError && ticket) {
        return tenant.slug;
      }
    } catch (error) {
      // Continue searching if this tenant doesn't have the ticket
      continue;
    }
  }

  return null;
}

// POST /api/gate/scan - Gate service scan endpoint
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Get HMAC signature from headers
  const signature = request.headers.get('x-gate-signature');
  const gateDeviceId = request.headers.get('x-gate-device-id');

  if (!signature) {
    throw new UnauthorizedError('Missing HMAC signature');
  }

  // Get the raw request body for signature validation
  const rawBody = await request.text();

  // Validate HMAC signature
  const gateSecret = process.env.GATE_SERVICE_SECRET;
  if (!gateSecret) {
    console.error('Gate service secret not configured');
    throw new Error('Gate service not properly configured');
  }

  if (!validateHMACSignature(rawBody, signature, gateSecret)) {
    throw new UnauthorizedError('Invalid HMAC signature');
  }

  // Parse and validate request body
  const body = JSON.parse(rawBody);
  const validatedData = validateRequestBody(body, gateScanRequestSchema);
  const { tenantId, ticketId, scanData, gateId, timestamp, deviceInfo } = validatedData;

  const supabase = createAdminClient();

  try {
    // If tenantId is provided in the request, use it
    // Otherwise, try to find the tenant for this ticket
    let finalTenantId = tenantId;
    if (!finalTenantId) {
      finalTenantId = await findTenantForTicket(supabase, ticketId);
      if (!finalTenantId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Tenant not found for this ticket',
            ticketId,
          },
          { status: 404 }
        );
      }
    }

    // Validate tenant exists and is active
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, slug, status')
      .eq('slug', finalTenantId)
      .eq('status', 'active')
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tenant not found or inactive',
          tenantId: finalTenantId,
        },
        { status: 404 }
      );
    }

    // Call the tenant's ticket validation endpoint
    const validationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/${finalTenantId}/tickets/${ticketId}/validate`;

    const validationPayload = {
      scanData,
      gateId,
      deviceInfo: {
        ...deviceInfo,
        deviceId: gateDeviceId || deviceInfo?.deviceId,
      },
      timestamp: timestamp || Date.now(),
    };

    const validationResponse = await fetch(validationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GateService/1.0',
      },
      body: JSON.stringify(validationPayload),
    });

    if (!validationResponse.ok) {
      const errorData = await validationResponse.json().catch(() => ({}));
      console.error('Ticket validation failed:', validationResponse.status, errorData);

      // Log the failed gate scan attempt
      await logGateScanError(
        supabase,
        finalTenantId,
        ticketId,
        gateId,
        scanData,
        `Validation API error: ${validationResponse.status}`
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Ticket validation failed',
          ticketId,
          tenantId: finalTenantId,
          details: errorData.error || 'Unknown error',
        },
        { status: validationResponse.status }
      );
    }

    const validationResult = await validationResponse.json();

    // Return the validation result with gate service metadata
    return NextResponse.json({
      success: true,
      tenantId: finalTenantId,
      ticketId,
      gateId,
      scanTime: new Date().toISOString(),
      validationResult: validationResult.data || validationResult,
      gateway: {
        service: 'gate-service',
        version: '1.0',
        deviceId: gateDeviceId,
      },
    });

  } catch (error) {
    console.error('Gate scan error:', error);

    // Try to log the error
    try {
      await logGateScanError(
        supabase,
        tenantId,
        ticketId,
        gateId,
        scanData,
        `Gateway error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } catch (logError) {
      console.error('Failed to log gate scan error:', logError);
    }

    throw error;
  }
});

// GET /api/gate/scan - Health check endpoint
export async function GET() {
  return NextResponse.json({
    service: 'gate-service',
    status: 'active',
    timestamp: new Date().toISOString(),
    version: '1.0',
  });
}

/**
 * Log gate scan errors when we can't reach the tenant's validation endpoint
 */
async function logGateScanError(
  supabase: any,
  tenantSlug: string,
  ticketId: string,
  gateId: string,
  scanData: string,
  errorMessage: string
): Promise<void> {
  try {
    const schemaName = `tenant_${tenantSlug}`;

    const logData = {
      ticket_id: ticketId,
      gate_id: gateId,
      scan_result: 'failed',
      scan_data: { scanData, gatewayError: true },
      error_message: errorMessage,
    };

    const { error: logError } = await supabase
      .schema(schemaName)
      .from('gate_logs')
      .insert([logData]);

    if (logError) {
      console.error('Error logging gate scan error:', logError);
    }
  } catch (error) {
    console.error('Failed to log gate scan error:', error);
  }
}

/**
 * Generate HMAC signature for gate service requests
 */
export function generateGateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Create a gate service request payload
 */
export function createGateRequest(
  tenantId: string,
  ticketId: string,
  scanData: string,
  gateId: string,
  deviceInfo?: {
    deviceId: string;
    location?: string;
    version?: string;
  }
) {
  const payload = {
    tenantId,
    ticketId,
    scanData,
    gateId,
    timestamp: Date.now(),
    deviceInfo,
  };

  const secret = process.env.GATE_SERVICE_SECRET;
  if (!secret) {
    throw new Error('Gate service secret not configured');
  }

  const signature = generateGateSignature(JSON.stringify(payload), secret);

  return {
    payload,
    signature,
  };
}