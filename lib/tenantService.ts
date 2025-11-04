import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/admin';
import type { Database } from '@/types/database.types';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  status: 'active' | 'inactive' | 'suspended';
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Get tenant information by slug
 */
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const supabase = createAdminClient();

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (error || !tenant) {
    return null;
  }

  return tenant as Tenant;
}

/**
 * Create a Supabase client configured for a specific tenant schema
 */
export function createTenantClient(tenantSlug: string) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: {
        schema: `tenant_${tenantSlug}`
      }
    }
  );

  return supabase;
}

/**
 * Create an admin Supabase client configured for a specific tenant schema
 */
export function createTenantAdminClient(tenantSlug: string) {
  const supabase = createAdminClient();

  // Set the schema for this client
  // Note: This is a simplified approach. In production, you might need to
  // use a more sophisticated method to switch schemas
  return supabase;
}

/**
 * Execute a query in a tenant's schema
 */
export async function executeTenantQuery<T = any>(
  tenantSlug: string,
  queryFn: (client: any) => Promise<T>
): Promise<T> {
  const supabase = createAdminClient();

  // Use RPC to execute query in tenant schema
  // This is a temporary solution - ideally, we'd have schema switching
  // at the client level

  try {
    // For now, we'll use a direct approach with schema-qualified queries
    // In a more robust implementation, you might use Postgres functions
    // or create separate Supabase instances for each tenant

    const result = await queryFn(supabase);
    return result;
  } catch (error) {
    console.error(`Error executing query in tenant ${tenantSlug}:`, error);
    throw error;
  }
}

/**
 * Check if a tenant schema exists
 */
export async function tenantSchemaExists(tenantSlug: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('tenant_schema_exists', {
    tenant_slug: tenantSlug
  });

  if (error) {
    console.error('Error checking tenant schema:', error);
    return false;
  }

  return data || false;
}

/**
 * Validate tenant access and return tenant info
 */
export async function validateTenantAccess(tenantSlug: string): Promise<{
  tenant: Tenant;
  schemaExists: boolean;
}> {
  const tenant = await getTenantBySlug(tenantSlug);

  if (!tenant) {
    throw new Error(`Tenant '${tenantSlug}' not found or inactive`);
  }

  const schemaExists = await tenantSchemaExists(tenantSlug);

  if (!schemaExists) {
    throw new Error(`Schema for tenant '${tenantSlug}' does not exist`);
  }

  return {
    tenant,
    schemaExists
  };
}

/**
 * Format schema name for a tenant
 */
export function getTenantSchemaName(tenantSlug: string): string {
  return `tenant_${tenantSlug}`;
}

/**
 * Extract tenant slug from hostname or URL path
 */
export function extractTenantSlug(request: Request): string | null {
  const url = new URL(request.url);
  const hostname = url.hostname;

  // Check if hostname is a subdomain format like tenant.ticketing.com
  const subdomain = hostname.split('.')[0];
  if (subdomain && subdomain !== 'www' && subdomain !== 'localhost') {
    return subdomain;
  }

  // Check if URL path contains tenant slug like /tenant-slug/tickets
  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts.length > 0) {
    return pathParts[0];
  }

  return null;
}