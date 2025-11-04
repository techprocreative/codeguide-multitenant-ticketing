import { NextRequest, NextResponse } from 'next/server';
import { ensureTenantContext } from '@/lib/tenantContext';
import { withErrorHandler, createSuccessResponse } from '@/lib/errorHandling';
import { validateRequestBody, validateQueryParams } from '@/lib/validation';
import { createEventSchema, paginationSchema, searchSchema, dateRangeSchema } from '@/lib/validation';
import { createAdminClient } from '@/utils/supabase/admin';

// GET /api/[tenantId]/events - List events
export const GET = withErrorHandler(async (request: NextRequest) => {
  const tenantContext = await ensureTenantContext(request);
  const supabase = createAdminClient();

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const queryData = Object.fromEntries(searchParams.entries());

  const validatedQuery = validateQueryParams(queryData, paginationSchema);
  const { page, limit, sort, order } = validatedQuery;

  // Parse optional filters
  const searchQuery = searchParams.get('search');
  const status = searchParams.get('status');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    // Build query
    let query = supabase
      .schema(tenantContext.schema)
      .from('events')
      .select('*', { count: 'exact' });

    // Apply filters
    if (searchQuery) {
      query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,venue.ilike.%${searchQuery}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    // Apply sorting
    const sortField = sort || 'date';
    query = query.order(sortField, { ascending: order === 'asc' });

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: events, error, count } = await query;

    if (error) {
      console.error('Error fetching events:', error);
      return NextResponse.json(
        { error: 'Failed to fetch events' },
        { status: 500 }
      );
    }

    return createSuccessResponse({
      events: events || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });

  } catch (error) {
    console.error('Events list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
});

// POST /api/[tenantId]/events - Create new event
export const POST = withErrorHandler(async (request: NextRequest) => {
  const tenantContext = await ensureTenantContext(request);
  const supabase = createAdminClient();

  // Validate request body
  const body = await request.json();
  const validatedData = validateRequestBody(body, createEventSchema);

  try {
    const { data: event, error } = await supabase
      .schema(tenantContext.schema)
      .from('events')
      .insert([{
        ...validatedData,
        date: new Date(validatedData.date).toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating event:', error);
      return NextResponse.json(
        { error: 'Failed to create event' },
        { status: 500 }
      );
    }

    return createSuccessResponse(event, 'Event created successfully', 201);

  } catch (error) {
    console.error('Event creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
});