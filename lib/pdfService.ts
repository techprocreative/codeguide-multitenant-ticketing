import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import { Ticket, Event, User } from '@/types/database.types';

export interface TicketPDFData {
  ticket: Ticket;
  event: Event;
  user: User;
  tenantName: string;
  qrCodeDataURL: string;
}

/**
 * Generate a PDF ticket
 */
export async function generateTicketPDF(data: TicketPDFData): Promise<Uint8Array> {
  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage(PageSizes.A4);

    // Get fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Get the first page
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();

    // Define margins and positions
    const margin = 50;
    const contentWidth = width - 2 * margin;

    // Add header
    await addHeader(page, helveticaBoldFont, data.tenantName, margin, height);

    // Add event details
    await addEventDetails(page, helveticaFont, helveticaBoldFont, data.event, margin, height - 120, contentWidth);

    // Add ticket details
    await addTicketDetails(page, helveticaFont, helveticaBoldFont, data.ticket, margin, height - 250, contentWidth);

    // Add user details
    await addUserDetails(page, helveticaFont, helveticaBoldFont, data.user, margin, height - 350, contentWidth);

    // Add QR code
    await addQRCode(page, data.qrCodeDataURL, width - 200, height - 450);

    // Add footer
    await addFooter(page, helveticaFont, margin, 50, contentWidth);

    // Add border
    await addBorder(page, margin, margin, width - margin, height - margin);

    // Serialize the PDFDocument to bytes
    const pdfBytes = await pdfDoc.save();

    return pdfBytes;
  } catch (error) {
    console.error('Error generating PDF ticket:', error);
    throw new Error('Failed to generate PDF ticket');
  }
}

/**
 * Add header section to PDF
 */
async function addHeader(
  page: any,
  font: any,
  tenantName: string,
  margin: number,
  height: number
) {
  page.drawText('TICKET', {
    x: margin,
    y: height - 60,
    size: 32,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawText(tenantName, {
    x: margin,
    y: height - 90,
    size: 18,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
}

/**
 * Add event details section to PDF
 */
async function addEventDetails(
  page: any,
  regularFont: any,
  boldFont: any,
  event: Event,
  margin: number,
  y: number,
  contentWidth: number
) {
  // Section title
  page.drawText('Event Details', {
    x: margin,
    y,
    size: 16,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // Draw line
  page.drawLine({
    start: { x: margin, y: y - 5 },
    end: { x: margin + contentWidth, y: y - 5 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  // Event title
  page.drawText(event.title, {
    x: margin,
    y: y - 30,
    size: 20,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // Event details
  const lineHeight = 20;
  let currentY = y - 60;

  if (event.description) {
    page.drawText(`Description: ${event.description}`, {
      x: margin,
      y: currentY,
      size: 12,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    currentY -= lineHeight;
  }

  if (event.date) {
    const eventDate = new Date(event.date).toLocaleString();
    page.drawText(`Date: ${eventDate}`, {
      x: margin,
      y: currentY,
      size: 12,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    currentY -= lineHeight;
  }

  if (event.venue) {
    page.drawText(`Venue: ${event.venue}`, {
      x: margin,
      y: currentY,
      size: 12,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    currentY -= lineHeight;
  }

  if (event.price) {
    page.drawText(`Price: $${event.price.toFixed(2)}`, {
      x: margin,
      y: currentY,
      size: 12,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
  }
}

/**
 * Add ticket details section to PDF
 */
async function addTicketDetails(
  page: any,
  regularFont: any,
  boldFont: any,
  ticket: Ticket,
  margin: number,
  y: number,
  contentWidth: number
) {
  // Section title
  page.drawText('Ticket Information', {
    x: margin,
    y,
    size: 16,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // Draw line
  page.drawLine({
    start: { x: margin, y: y - 5 },
    end: { x: margin + contentWidth, y: y - 5 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  // Ticket ID
  page.drawText(`Ticket ID: ${ticket.id.substring(0, 8).toUpperCase()}`, {
    x: margin,
    y: y - 30,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });

  // Status
  const statusColor = ticket.status === 'valid' ? rgb(0, 0.5, 0) : rgb(0.8, 0, 0);
  page.drawText(`Status: ${ticket.status.toUpperCase()}`, {
    x: margin,
    y: y - 50,
    size: 12,
    font: boldFont,
    color: statusColor,
  });

  // Purchase date
  if (ticket.purchased_at) {
    const purchaseDate = new Date(ticket.purchased_at).toLocaleString();
    page.drawText(`Purchased: ${purchaseDate}`, {
      x: margin,
      y: y - 70,
      size: 12,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
  }
}

/**
 * Add user details section to PDF
 */
async function addUserDetails(
  page: any,
  regularFont: any,
  boldFont: any,
  user: User,
  margin: number,
  y: number,
  contentWidth: number
) {
  // Section title
  page.drawText('Attendee Information', {
    x: margin,
    y,
    size: 16,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // Draw line
  page.drawLine({
    start: { x: margin, y: y - 5 },
    end: { x: margin + contentWidth, y: y - 5 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  // User name
  page.drawText(`Name: ${user.name || 'N/A'}`, {
    x: margin,
    y: y - 30,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });

  // User email
  page.drawText(`Email: ${user.email}`, {
    x: margin,
    y: y - 50,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0),
  });

  // User phone
  if (user.phone) {
    page.drawText(`Phone: ${user.phone}`, {
      x: margin,
      y: y - 70,
      size: 12,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
  }
}

/**
 * Add QR code to PDF
 */
async function addQRCode(
  page: any,
  qrCodeDataURL: string,
  x: number,
  y: number
) {
  try {
    // Convert data URL to image
    const qrImage = await page.doc.embedPng(qrCodeDataURL);

    // Draw QR code image
    page.drawImage(qrImage, {
      x,
      y,
      width: 150,
      height: 150,
    });

    // Add QR code label
    page.drawText('Scan for Validation', {
      x: x + 25,
      y: y - 20,
      size: 10,
      font: await page.doc.embedFont(StandardFonts.Helvetica),
      color: rgb(0.5, 0.5, 0.5),
    });
  } catch (error) {
    console.error('Error adding QR code to PDF:', error);
    // Add fallback text if QR code fails
    page.drawText('QR Code Unavailable', {
      x,
      y: y - 75,
      size: 12,
      font: await page.doc.embedFont(StandardFonts.Helvetica),
      color: rgb(1, 0, 0),
    });
  }
}

/**
 * Add footer section to PDF
 */
async function addFooter(
  page: any,
  font: any,
  margin: number,
  y: number,
  contentWidth: number
) {
  const footerText = 'This is a digital ticket. Please keep it safe and present it at the entrance. ' +
    'Duplicate or altered tickets will not be accepted.';

  // Add footer text
  page.drawText(footerText, {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Add generated date
  const generatedText = `Generated on ${new Date().toLocaleString()}`;
  page.drawText(generatedText, {
    x: margin,
    y: y - 20,
    size: 8,
    font,
    color: rgb(0.7, 0.7, 0.7),
  });
}

/**
 * Add border to PDF
 */
async function addBorder(
  page: any,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  page.drawRectangle({
    x: x1 - 10,
    y: y1 - 10,
    width: x2 - x1 + 20,
    height: y2 - y1 + 20,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 2,
  });
}

/**
 * Upload PDF to Supabase Storage
 */
export async function uploadTicketPDF(
  pdfBytes: Uint8Array,
  ticketId: string,
  tenantSlug: string
): Promise<string> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const fileName = `tickets/${tenantSlug}/${ticketId}/ticket.pdf`;
    const file = new Blob([pdfBytes], { type: 'application/pdf' });

    const { data, error } = await supabase.storage
      .from('tickets')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error('Error uploading PDF to Supabase:', error);
      throw new Error('Failed to upload ticket PDF');
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('tickets')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading PDF:', error);
    throw new Error('Failed to upload ticket PDF');
  }
}

/**
 * Generate and upload ticket PDF
 */
export async function generateAndUploadTicketPDF(data: TicketPDFData): Promise<string> {
  const pdfBytes = await generateTicketPDF(data);
  const publicUrl = await uploadTicketPDF(
    pdfBytes,
    data.ticket.id,
    data.tenantSlug.toLowerCase().replace(/[^a-z0-9]/g, '-')
  );

  return publicUrl;
}