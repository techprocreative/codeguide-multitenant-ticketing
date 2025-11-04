import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { validateTenantAccess, extractTenantSlug } from "@/lib/tenantService"

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/api/([^/]+)/tickets/:path*',
  '/api/([^/]+)/events/:path*',
  '/dashboard',
  '/profile',
])

// Define admin routes that require special permissions
const isAdminRoute = createRouteMatcher([
  '/api/tenants',
  '/admin',
])

export default clerkMiddleware(async (auth, req) => {
  // Get the tenant slug from the request
  const tenantSlug = extractTenantSlug(req)

  // Handle API routes that need tenant context
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const pathParts = req.nextUrl.pathname.split('/').filter(Boolean)

    // Check if this is a tenant-specific API route
    if (pathParts.length >= 2 && pathParts[0] === 'api' && pathParts[1] !== 'tenants' && pathParts[1] !== 'gate') {
      const apiTenantSlug = pathParts[1]

      try {
        // Validate tenant access
        const { tenant, schemaExists } = await validateTenantAccess(apiTenantSlug)

        // Add tenant context to headers for downstream processing
        const response = NextResponse.next()
        response.headers.set('x-tenant-id', tenant.id)
        response.headers.set('x-tenant-slug', tenant.slug)
        response.headers.set('x-tenant-schema', `tenant_${tenant.slug}`)

        return response
      } catch (error) {
        console.error('Tenant validation error:', error)
        return NextResponse.json(
          { error: 'Invalid or inactive tenant' },
          { status: 404 }
        )
      }
    }

    // Handle protected API routes
    if (isProtectedRoute(req)) {
      const { userId } = auth()

      if (!userId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
    }

    // Handle admin API routes
    if (isAdminRoute(req)) {
      const { userId } = auth()

      if (!userId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }

      // TODO: Add additional admin role check here
      // You might want to check if the user has admin privileges
    }
  }

  // Handle protected frontend routes
  if (isProtectedRoute(req)) {
    const { userId } = auth()

    if (!userId) {
      // Redirect to sign-in page
      const signInUrl = new URL('/sign-in', req.url)
      signInUrl.searchParams.set('redirect_url', req.url)
      return NextResponse.redirect(signInUrl)
    }

    // If tenant context is required for this route
    if (tenantSlug) {
      try {
        await validateTenantAccess(tenantSlug)

        // Add tenant context to headers for server components
        const response = NextResponse.next()
        response.headers.set('x-tenant-slug', tenantSlug)
        return response
      } catch (error) {
        console.error('Tenant validation error:', error)
        return NextResponse.redirect(new URL('/not-found', req.url))
      }
    }
  }

  // Handle admin frontend routes
  if (isAdminRoute(req)) {
    const { userId } = auth()

    if (!userId) {
      const signInUrl = new URL('/sign-in', req.url)
      signInUrl.searchParams.set('redirect_url', req.url)
      return NextResponse.redirect(signInUrl)
    }

    // TODO: Add admin role check
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)|api/webhooks).*)",
  ],
}
