import { createHash } from 'crypto';

// Tripay configuration - these should be in environment variables
const TRIPAY_API_URL = process.env.TRIPAY_API_URL || 'https://tripay.co.id/api';
const TRIPAY_API_KEY = process.env.TRIPAY_API_KEY;
const TRIPAY_PRIVATE_KEY = process.env.TRIPAY_PRIVATE_KEY;
const TRIPAY_MERCHANT_CODE = process.env.TRIPAY_MERCHANT_CODE;

export interface TripayPaymentRequest {
  method: string;
  merchant_ref: string;
  amount: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  order_items: Array<{
    sku: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  callback_url: string;
  return_url: string;
  expired_time: number; // Unix timestamp
}

export interface TripayPaymentResponse {
  success: boolean;
  message: string;
  data?: {
    reference: string;
    checkout_url: string;
    pay_url?: string;
    expired_time: number;
    status: 'UNPAID' | 'PAID' | 'REFUNDED' | 'EXPIRED' | 'FAILED';
  };
}

export interface TripayTransactionStatus {
  success: boolean;
  message: string;
  data?: {
    reference: string;
    merchant_ref: string;
    payment_method: string;
    payment_method_name: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    amount: number;
    fee_merchant: number;
    fee_customer: number;
    total_fee: number;
    amount_received: number;
    status: 'UNPAID' | 'PAID' | 'REFUNDED' | 'EXPIRED' | 'FAILED';
    note?: string;
    checkout_url: string;
    created_at: number;
    expired_at: number;
    paid_at?: number;
  };
}

export interface TripayChannel {
  code: string;
  name: string;
  icon: string;
  active: boolean;
  fee: {
    flat: number;
    percent: number;
  };
}

/**
 * Generate signature for Tripay API requests
 */
function generateSignature(payload: string): string {
  if (!TRIPAY_PRIVATE_KEY) {
    throw new Error('Tripay private key not configured');
  }

  return createHash('sha256')
    .update(payload)
    .digest('hex');
}

/**
 * Get available payment channels from Tripay
 */
export async function getPaymentChannels(): Promise<TripayChannel[]> {
  if (!TRIPAY_API_KEY) {
    throw new Error('Tripay API key not configured');
  }

  try {
    const response = await fetch(`${TRIPAY_API_URL}/v3/payment/channel`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TRIPAY_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Tripay API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(`Tripay error: ${result.message}`);
    }

    return result.data || [];
  } catch (error) {
    console.error('Error fetching Tripay channels:', error);
    throw new Error('Failed to fetch payment channels');
  }
}

/**
 * Create a payment transaction with Tripay
 */
export async function createPayment(request: TripayPaymentRequest): Promise<TripayPaymentResponse> {
  if (!TRIPAY_API_KEY || !TRIPAY_PRIVATE_KEY || !TRIPAY_MERCHANT_CODE) {
    throw new Error('Tripay credentials not configured');
  }

  try {
    // Prepare the payload
    const payload = {
      method: request.method,
      merchant_ref: request.merchant_ref,
      amount: request.amount,
      customer_name: request.customer_name,
      customer_email: request.customer_email,
      customer_phone: request.customer_phone,
      order_items: request.order_items,
      callback_url: request.callback_url,
      return_url: request.return_url,
      expired_time: Math.floor(request.expired_time),
      signature: generateSignature(JSON.stringify(request)),
    };

    const response = await fetch(`${TRIPAY_API_URL}/v3/transaction/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TRIPAY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Tripay API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(`Tripay error: ${result.message}`);
    }

    return result;
  } catch (error) {
    console.error('Error creating Tripay payment:', error);
    throw new Error('Failed to create payment transaction');
  }
}

/**
 * Check transaction status with Tripay
 */
export async function checkTransactionStatus(reference: string): Promise<TripayTransactionStatus> {
  if (!TRIPAY_API_KEY) {
    throw new Error('Tripay API key not configured');
  }

  try {
    const response = await fetch(`${TRIPAY_API_URL}/v3/transaction/detail?reference=${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TRIPAY_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Tripay API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(`Tripay error: ${result.message}`);
    }

    return result;
  } catch (error) {
    console.error('Error checking Tripay transaction status:', error);
    throw new Error('Failed to check transaction status');
  }
}

/**
 * Verify Tripay callback signature
 */
export function verifyCallbackSignature(
  payload: string,
  signature: string
): boolean {
  if (!TRIPAY_PRIVATE_KEY) {
    return false;
  }

  const expectedSignature = generateSignature(payload);
  return signature === expectedSignature;
}

/**
 * Map Tripay status to our internal payment status
 */
export function mapTripayStatus(tripayStatus: string): 'pending' | 'success' | 'failed' | 'expired' {
  switch (tripayStatus.toUpperCase()) {
    case 'PAID':
      return 'success';
    case 'UNPAID':
      return 'pending';
    case 'FAILED':
      return 'failed';
    case 'EXPIRED':
      return 'expired';
    case 'REFUNDED':
      return 'failed'; // Or you could add a 'refunded' status
    default:
      return 'pending';
  }
}

/**
 * Format order items for Tripay API
 */
export function formatOrderItems(
  tickets: Array<{
    id: string;
    eventName: string;
    price: number;
    quantity: number;
  }>
) {
  return tickets.map((ticket, index) => ({
    sku: `TICKET-${ticket.id}`,
    name: ticket.eventName,
    price: ticket.price,
    quantity: ticket.quantity,
  }));
}

/**
 * Generate merchant reference for Tripay
 */
export function generateMerchantReference(tenantSlug: string, eventId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${tenantSlug.toUpperCase()}-${eventId.substring(0, 8)}-${timestamp}-${random}`;
}