import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { z } from 'zod';

// Schema for tenant update
const updateTenantSchema = z.object({
  name: z.string().min(1, 'Tenant name is required').optional(),
  domain: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  settings: z.object({}).optional(),
});

// GET /api/tenants/[slug] - Get a specific tenant
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createAdminClient();

    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('slug', params.slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Tenant not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching tenant:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tenant' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/tenants/[slug] - Update a tenant
export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await request.json();
    const validatedData = updateTenantSchema.parse(body);

    const supabase = createAdminClient();

    const { data: tenant, error } = await supabase
      .from('tenants')
      .update(validatedData)
      .eq('slug', params.slug)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Tenant not found' },
          { status: 404 }
        );
      }
      console.error('Error updating tenant:', error);
      return NextResponse.json(
        { error: 'Failed to update tenant' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tenant });
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

// DELETE /api/tenants/[slug] - Delete a tenant and its schema
export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createAdminClient();

    // First, get the tenant to check if it exists
    const { data: tenant, error: fetchError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('slug', params.slug)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Tenant not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching tenant:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch tenant' },
        { status: 500 }
      );
    }

    // Drop the tenant schema
    const { error: schemaError } = await supabase.rpc('drop_tenant_schema', {
      tenant_slug: params.slug
    });

    if (schemaError) {
      console.error('Error dropping tenant schema:', schemaError);
      return NextResponse.json(
        { error: 'Failed to drop tenant schema: ' + schemaError.message },
        { status: 500 }
      );
    }

    // Delete the tenant record
    const { error: deleteError } = await supabase
      .from('tenants')
      .delete()
      .eq('slug', params.slug);

    if (deleteError) {
      console.error('Error deleting tenant record:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete tenant record' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Tenant '${tenant.name}' and its schema have been deleted successfully`
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}