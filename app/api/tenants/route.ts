import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { z } from 'zod';

// Schema for tenant creation
const createTenantSchema = z.object({
  name: z.string().min(1, 'Tenant name is required'),
  slug: z.string()
    .min(1, 'Tenant slug is required')
    .regex(/^[a-z0-9_-]+$/, 'Tenant slug can only contain lowercase letters, numbers, underscores, and hyphens'),
  domain: z.string().optional(),
  settings: z.object({}).optional().default({}),
});

// Schema for tenant update
const updateTenantSchema = z.object({
  name: z.string().min(1, 'Tenant name is required').optional(),
  domain: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  settings: z.object({}).optional(),
});

// GET /api/tenants - List all tenants
export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tenants:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tenants' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tenants });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/tenants - Create a new tenant with schema provisioning
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createTenantSchema.parse(body);

    const supabase = createAdminClient();

    // Start a transaction-like operation
    // First, create the tenant record
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert([{
        name: validatedData.name,
        slug: validatedData.slug,
        domain: validatedData.domain,
        status: 'active',
        settings: validatedData.settings,
      }])
      .select()
      .single();

    if (tenantError) {
      console.error('Error creating tenant:', tenantError);

      // Check if it's a duplicate slug error
      if (tenantError.code === '23505') {
        return NextResponse.json(
          { error: 'A tenant with this slug already exists' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create tenant' },
        { status: 500 }
      );
    }

    // Now create the schema for the tenant
    const { error: schemaError } = await supabase.rpc('create_tenant_schema', {
      tenant_slug: validatedData.slug
    });

    if (schemaError) {
      console.error('Error creating tenant schema:', schemaError);

      // Rollback: delete the tenant record if schema creation failed
      await supabase
        .from('tenants')
        .delete()
        .eq('id', tenant.id);

      return NextResponse.json(
        { error: 'Failed to provision tenant schema: ' + schemaError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      tenant,
      message: 'Tenant created successfully with schema provisioned'
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}