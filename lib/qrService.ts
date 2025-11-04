import QRCode from 'qrcode';
import { randomBytes } from 'crypto';

export interface QRCodeData {
  ticketId: string;
  tenantSlug: string;
  eventId: string;
  userId: string;
  timestamp: number;
  signature: string;
}

/**
 * Generate a unique QR code for a ticket
 */
export async function generateTicketQRCode(
  ticketId: string,
  tenantSlug: string,
  eventId: string,
  userId: string
): Promise<string> {
  const timestamp = Date.now();

  // Create the QR code data
  const qrData: QRCodeData = {
    ticketId,
    tenantSlug,
    eventId,
    userId,
    timestamp,
    signature: await generateSignature(ticketId, timestamp),
  };

  // Generate QR code string
  const qrString = `TICKET_${tenantSlug}_${await formatQRCodeData(qrData)}`;

  // Generate QR code image as data URL
  try {
    const qrCodeDataURL = await QRCode.toDataURL(qrString, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H', // High error correction for durability
    });

    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate a signature for QR code verification
 */
async function generateSignature(ticketId: string, timestamp: number): Promise<string> {
  const secret = process.env.QR_SIGNATURE_SECRET || 'default-secret-key';
  const data = `${ticketId}-${timestamp}`;

  // Simple HMAC-like signature (in production, use crypto.createHmac)
  const signature = Buffer.from(data + secret).toString('base64');
  return signature.substring(0, 16); // Truncate for shorter QR codes
}

/**
 * Format QR code data as a compact string
 */
async function formatQRCodeData(data: QRCodeData): Promise<string> {
  const dataString = JSON.stringify(data);
  const compressed = Buffer.from(dataString).toString('base64');
  return compressed.substring(0, 32); // Limit length for QR codes
}

/**
 * Parse and verify QR code data
 */
export function parseQRCodeData(qrString: string): QRCodeData | null {
  try {
    // Extract the data part from QR string
    // Format: TICKET_tenantSlug_base64data
    const match = qrString.match(/^TICKET_[a-z0-9_-]+_([A-Za-z0-9+/=]+)$/);
    if (!match) {
      return null;
    }

    const base64Data = match[1];
    const jsonString = Buffer.from(base64Data, 'base64').toString('utf8');
    const data: QRCodeData = JSON.parse(jsonString);

    // Verify signature
    if (!verifySignature(data)) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error parsing QR code data:', error);
    return null;
  }
}

/**
 * Verify QR code signature
 */
function verifySignature(data: QRCodeData): boolean {
  try {
    const secret = process.env.QR_SIGNATURE_SECRET || 'default-secret-key';
    const expectedSignature = Buffer.from(`${data.ticketId}-${data.timestamp}${secret}`).toString('base64').substring(0, 16);

    // Check if signature matches and timestamp is not too old (24 hours)
    const signatureValid = data.signature === expectedSignature;
    const notExpired = Date.now() - data.timestamp < 24 * 60 * 60 * 1000; // 24 hours

    return signatureValid && notExpired;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

/**
 * Generate a simple text-based QR code for testing
 */
export async function generateSimpleQRCode(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  } catch (error) {
    console.error('Error generating simple QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Validate QR code format
 */
export function validateQRCodeFormat(qrString: string): boolean {
  const qrCodePattern = /^TICKET_[a-z0-9_-]+_[A-Za-z0-9+/=]{20,}$/;
  return qrCodePattern.test(qrString);
}

/**
 * Extract ticket ID from QR code string
 */
export function extractTicketIdFromQR(qrString: string): string | null {
  const data = parseQRCodeData(qrString);
  return data?.ticketId || null;
}

/**
 * Generate backup QR code (fallback)
 */
export function generateBackupQRCode(ticketId: string, tenantSlug: string): string {
  const timestamp = Date.now();
  const randomBytesValue = randomBytes(8).toString('hex').toUpperCase();
  return `TICKET_${tenantSlug}_${ticketId.substring(0, 8)}_${timestamp.toString(36)}_${randomBytesValue}`;
}