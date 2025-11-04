import { NextRequest, NextResponse } from 'next/server';
import { ensureTenantContext } from '@/lib/tenantContext';
import { withErrorHandler, createSuccessResponse } from '@/lib/errorHandling';
import { validateQueryParams } from '@/lib/validation';
import { paginationSchema, dateRangeSchema } from '@/lib/validation';
import { createAdminClient } from '@/utils/supabase/admin';

// GET /api/[tenantId]/tickets - List tickets
export const GET = withErrorHandler(async (request: NextRequest) => {
  const tenantContext = await ensureTenantContext(request);
  const supabase = createAdminClient();

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const queryData = Object.fromEntries(searchParams.entries());

  const validatedQuery = validateQueryParams(queryData, paginationSchema);
  const { page, limit, sort, order } = validatedQuery;

  // Parse optional filters
  const status = searchParams.get('status');
  const eventId = searchParams.get('eventId');
  const userId = searchParams.get('userId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    // Build query with related data
    let query = supabase
      .schema(tenantContext.schema)
      .from('tickets')
      .select(`
        *,
        events:event_id (
          id,
          title,
          date,
          venue,
          price
        ),
        users:user_id (
          id,
          name,
          email,
          phone
        ),
        payments:ticket_id (
          id,
          amount,
          method,
          status,
          created_at
        )
      `, { count: 'exact' });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (startDate) {
      query = query.gte('purchased_at', startDate);
    }

    if (endDate) {
      query = query.lte('purchased_at', endDate);
    }

    // Apply sorting
    const sortField = sort || 'purchased_at';
    query = query.order(sortField, { ascending: order === 'asc' });

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: tickets, error, count } = await query;

    if (error) {
      console.error('Error fetching tickets:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tickets' },
        { status: 500 }
      );
    }

    return createSuccessResponse({
      tickets: tickets || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });

  } catch (error) {
    console.error('Tickets list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tickets' },
      { status: 500 }
    );
  }
});