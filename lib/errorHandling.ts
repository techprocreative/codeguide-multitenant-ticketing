import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { apiErrorSchema } from './validation';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public details?: any;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, true, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, true);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, true);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(message, 500, true);
  }
}

export class TenantError extends AppError {
  constructor(message: string, statusCode: number = 400) {
    super(message, statusCode, true);
  }
}

/**
 * Handle API errors and return appropriate responses
 */
export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationError = new ValidationError('Validation failed', error.errors);
    return NextResponse.json(
      {
        error: validationError.message,
        details: validationError.details,
      },
      { status: validationError.statusCode }
    );
  }

  // Handle custom application errors
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.message,
        details: error.details,
      },
      { status: error.statusCode }
    );
  }

  // Handle Supabase errors
  if (error && typeof error === 'object' && 'code' in error) {
    const supabaseError = error as any;

    switch (supabaseError.code) {
      case 'PGRST116':
        return NextResponse.json(
          { error: 'Resource not found' },
          { status: 404 }
        );
      case '23505':
        return NextResponse.json(
          { error: 'Resource already exists' },
          { status: 409 }
        );
      case '23503':
        return NextResponse.json(
          { error: 'Referenced resource does not exist' },
          { status: 400 }
        );
      case '23514':
        return NextResponse.json(
          { error: 'Data validation failed' },
          { status: 400 }
        );
      default:
        return NextResponse.json(
          { error: 'Database operation failed' },
          { status: 500 }
        );
    }
  }

  // Handle unknown errors
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}

/**
 * Wrapper for async API route handlers to catch errors
 */
export function withErrorHandler(
  handler: (request: Request, ...args: any[]) => Promise<Response>
) {
  return async (request: Request, ...args: any[]): Promise<Response> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  statusCode: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
    },
    { status: statusCode }
  );
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  message: string,
  statusCode: number = 400,
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      details,
    },
    { status: statusCode }
  );
}

/**
 * Validate request body against a schema
 */
export function validateRequestBody<T>(
  body: any,
  schema: z.ZodSchema<T>
): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError('Invalid request body', error.errors);
    }
    throw new ValidationError('Invalid request body');
  }
}

/**
 * Validate query parameters against a schema
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): T {
  const params: Record<string, any> = {};

  searchParams.forEach((value, key) => {
    // Try to parse as JSON, fallback to string
    try {
      params[key] = JSON.parse(value);
    } catch {
      params[key] = value;
    }
  });

  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError('Invalid query parameters', error.errors);
    }
    throw new ValidationError('Invalid query parameters');
  }
}

/**
 * Log errors with context information
 */
export function logError(
  error: unknown,
  context?: {
    request?: Request;
    tenant?: string;
    user?: string;
    action?: string;
  }
): void {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
  };

  if (error instanceof AppError) {
    logData.statusCode = error.statusCode;
    logData.isOperational = error.isOperational;
  }

  console.error(JSON.stringify(logData, null, 2));
}