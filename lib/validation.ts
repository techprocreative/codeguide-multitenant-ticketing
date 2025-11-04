import { z } from 'zod';

// Common validation schemas
export const uuidSchema = z.string().uuid('Invalid ID format');

export const emailSchema = z.string().email('Invalid email address');

export const phoneSchema = z.string()
  .regex(/^[+]?[\d\s\-\(\)]+$/, 'Invalid phone number format')
  .min(10, 'Phone number must be at least 10 digits')
  .optional();

// Tenant validation schemas
export const createTenantSchema = z.object({
  name: z.string().min(1, 'Tenant name is required').max(100, 'Tenant name too long'),
  slug: z.string()
    .min(1, 'Tenant slug is required')
    .max(50, 'Tenant slug too long')
    .regex(/^[a-z0-9_-]+$/, 'Tenant slug can only contain lowercase letters, numbers, underscores, and hyphens'),
  domain: z.string().url('Invalid domain URL').optional().nullable(),
  settings: z.object({}).optional().default({}),
});

export const updateTenantSchema = z.object({
  name: z.string().min(1, 'Tenant name is required').max(100, 'Tenant name too long').optional(),
  domain: z.string().url('Invalid domain URL').optional().nullable(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  settings: z.object({}).optional(),
});

// Event validation schemas
export const createEventSchema = z.object({
  title: z.string().min(1, 'Event title is required').max(200, 'Event title too long'),
  description: z.string().max(1000, 'Event description too long').optional(),
  date: z.string().datetime('Invalid date format'),
  venue: z.string().max(200, 'Venue name too long').optional(),
  price: z.number().min(0, 'Price must be non-negative').max(999999.99, 'Price too high'),
  max_tickets: z.number().int().min(1, 'Max tickets must be at least 1').optional(),
});

export const updateEventSchema = z.object({
  title: z.string().min(1, 'Event title is required').max(200, 'Event title too long').optional(),
  description: z.string().max(1000, 'Event description too long').optional(),
  date: z.string().datetime('Invalid date format').optional(),
  venue: z.string().max(200, 'Venue name too long').optional(),
  price: z.number().min(0, 'Price must be non-negative').max(999999.99, 'Price too high').optional(),
  max_tickets: z.number().int().min(1, 'Max tickets must be at least 1').optional(),
  status: z.enum(['upcoming', 'ongoing', 'completed', 'cancelled']).optional(),
});

// User validation schemas
export const createUserSchema = z.object({
  email: emailSchema,
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  phone: phoneSchema,
});

export const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  phone: phoneSchema,
});

// Ticket purchase validation schemas
export const ticketPurchaseSchema = z.object({
  eventId: uuidSchema,
  userId: uuidSchema.optional(), // Optional if creating user on the fly
  user: createUserSchema.optional(), // Create user if userId not provided
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(10, 'Maximum 10 tickets per purchase'),
});

export const paymentInfoSchema = z.object({
  method: z.enum(['cash', 'card', 'transfer', 'tripay']),
  amount: z.number().min(0, 'Amount must be non-negative'),
  tripayReference: z.string().optional(),
  gatewayResponse: z.object({}).optional(),
});

// Ticket validation schemas
export const ticketValidationSchema = z.object({
  ticketId: uuidSchema,
  scanData: z.string().min(1, 'Scan data is required'),
  gateId: z.string().min(1, 'Gate ID is required'),
});

// Payment validation schemas
export const paymentCreateSchema = z.object({
  ticketId: uuidSchema,
  amount: z.number().min(0, 'Amount must be non-negative'),
  method: z.enum(['cash', 'card', 'transfer', 'tripay']),
  tripayReference: z.string().optional(),
  gatewayResponse: z.object({}).optional(),
});

export const paymentUpdateSchema = z.object({
  status: z.enum(['pending', 'success', 'failed', 'refunded']),
  gatewayResponse: z.object({}).optional(),
});

// QR code validation schema
export const qrCodeSchema = z.string()
  .regex(/^TICKET_[a-z0-9_-]+_[A-F0-9]{32}$/, 'Invalid QR code format');

// Gate log validation schema
export const gateLogSchema = z.object({
  ticketId: uuidSchema,
  gateId: z.string().min(1, 'Gate ID is required'),
  scanResult: z.enum(['success', 'failed', 'duplicate', 'invalid']),
  scanData: z.object({}),
  errorMessage: z.string().optional(),
});

// API response schemas
export const apiErrorSchema = z.object({
  error: z.string(),
  details: z.any().optional(),
});

export const apiSuccessSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  message: z.string().optional(),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Date range filter schema
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Search schema
export const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(100, 'Search query too long'),
  field: z.string().optional(),
});

// Export type definitions for TypeScript
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type TicketPurchaseInput = z.infer<typeof ticketPurchaseSchema>;
export type PaymentInfoInput = z.infer<typeof paymentInfoSchema>;
export type TicketValidationInput = z.infer<typeof ticketValidationSchema>;
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
export type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>;
export type GateLogInput = z.infer<typeof gateLogSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
export type SearchInput = z.infer<typeof searchSchema>;