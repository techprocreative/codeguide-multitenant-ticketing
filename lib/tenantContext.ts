import { headers } from 'next/headers';
import { validateTenantAccess, getTenantBySlug } from './tenantService';
import { NextRequest } from 'next/server';

export interface TenantContext {
  id: string;
  slug: string;
  schema: string;
}

/**
 * Get tenant context from request headers
 */
export function getTenantContextFromHeaders(): TenantContext | null {
  const headersList = headers();
  const tenantId = headersList.get('x-tenant-id');
  const tenantSlug = headersList.get('x-tenant-slug');
  const tenantSchema = headersList.get('x-tenant-schema');

  if (!tenantId || !tenantSlug || !tenantSchema) {
    return null;
  }

  return {
    id: tenantId,
    slug: tenantSlug,
    schema: tenantSchema,
  };
}

/**
 * Get tenant context from request (works in API routes)
 */
export function getTenantContextFromRequest(request: NextRequest): TenantContext | null {
  const tenantId = request.headers.get('x-tenant-id');
  const tenantSlug = request.headers.get('x-tenant-slug');
  const tenantSchema = request.headers.get('x-tenant-schema');

  if (!tenantId || !tenantSlug || !tenantSchema) {
    return null;
  }

  return {
    id: tenantId,
    slug: tenantSlug,
    schema: tenantSchema,
  };
}

/**
 * Extract tenant slug from URL path (for manual extraction)
 */
export function extractTenantSlugFromPath(pathname: string): string | null {
  const pathParts = pathname.split('/').filter(Boolean);

  // Handle /api/[tenantId]/... format
  if (pathParts.length >= 2 && pathParts[0] === 'api') {
    const tenantId = pathParts[1];

    // Skip special API routes like /api/tenants, /api/gate
    if (tenantId !== 'tenants' && tenantId !== 'gate') {
      return tenantId;
    }
  }

  // Handle /tenantId/... format for frontend routes
  if (pathParts.length >= 1) {
    return pathParts[0];
  }

  return null;
}

/**
 * Validate tenant context and return tenant information
 */
export async function validateTenantContext(tenantSlug: string): Promise<TenantContext & { tenant: any }> {
  const tenant = await getTenantBySlug(tenantSlug);

  if (!tenant) {
    throw new Error(`Tenant '${tenantSlug}' not found or inactive`);
  }

  return {
    id: tenant.id,
    slug: tenant.slug,
    schema: `tenant_${tenant.slug}`,
    tenant,
  };
}

/**
 * Ensure tenant context is available and valid
 * This should be called at the beginning of tenant-specific API routes
 */
export async function ensureTenantContext(request: NextRequest): Promise<TenantContext> {
  let tenantContext = getTenantContextFromRequest(request);

  if (!tenantContext) {
    // Try to extract from pathname if not in headers
    const pathname = request.nextUrl.pathname;
    const tenantSlug = extractTenantSlugFromPath(pathname);

    if (tenantSlug) {
      tenantContext = await validateTenantContext(tenantSlug);
    } else {
      throw new Error('Tenant context not found');
    }
  }

  return tenantContext;
}

/**
 * Create a response with tenant context headers
 */
export function createTenantResponse(data: any, tenantContext: TenantContext, status = 200): Response {
  const response = Response.json(data, { status });

  response.headers.set('x-tenant-id', tenantContext.id);
  response.headers.set('x-tenant-slug', tenantContext.slug);
  response.headers.set('x-tenant-schema', tenantContext.schema);

  return response;
}