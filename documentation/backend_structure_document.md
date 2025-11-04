# Backend Structure Document for `codeguide-multitenant-ticketing`

This document outlines the backend architecture, hosting setup, infrastructure components, and operational practices for a multi-tenant online ticketing system built with Next.js 14, Supabase, Clerk, and Stripe. It’s intended to give a clear, non-technical overview of how the backend works and how it’s organized.

## 1. Backend Architecture

The backend is built into the same Next.js project that drives the frontend, using its App Router and API Routes. This unified approach simplifies development and deployment.

• Next.js 14 App Router
  – Handles server-side rendering (SSR), static site generation (SSG), and API endpoints under `app/api/`.
• Authentication & Authorization
  – Clerk issues secure JWTs for all users. A middleware inspects each request to ensure the user is logged in and belongs to the correct tenant.
• Multi-Tenancy via Row-Level Security (RLS)
  – All key tables include a `tenant_id` column. Supabase enforces RLS policies so that each tenant’s data is isolated from others.
• Utility Layer
  – Business logic lives in `utils/` (e.g., payment processing with Stripe, database calls via Supabase client, QR code and PDF generation).

This design supports:

- **Scalability:** The serverless nature of Next.js API Routes and the managed Supabase database mean you can handle spikes in traffic with minimal manual intervention.
- **Maintainability:** Shared code between frontend and backend in one repo, strong TypeScript types, and clear directory structure make it easy to onboard new developers.
- **Performance:** Next.js optimizes for SSR and edge caching, while Supabase real-time features and edge functions can speed up data fetching.

## 2. Database Management

We rely on Supabase, which provides a managed PostgreSQL database along with real-time subscriptions and automatic backups.

• Database Type: PostgreSQL (SQL)
• Provider: Supabase Cloud
• Data Organization:
  - Each table has a `tenant_id` column for multi-tenant isolation.
  - Row-Level Security (RLS) policies ensure users only see data belonging to their tenant.
  - Migrations are stored under `supabase/migrations/`, allowing version control of schema changes.
• Data Access:
  - Server-side code uses Supabase Admin client (`utils/supabase/admin.ts`) for inserts, updates, and deletes.
  - Client-side reads go through Supabase public client but are still scoped by RLS.

## 3. Database Schema

Below is a human-readable summary of the main tables, followed by SQL definitions you can use in Supabase migrations.

### Tables and Key Columns

1. Tenants
   - Unique identifier and metadata for each organization.
2. Users
   - Tracks individual users, linked to Clerk’s authentication.
3. Events
   - Details about each event (name, date, location).
4. Tickets
   - References a purchased ticket, linked to event, user, and payment.
5. Payments
   - Records Stripe payment sessions and statuses.
6. Gate_Logs
   - Logs each QR code scan: timestamp, result, scanner info.

### SQL Schema (PostgreSQL)

```sql
-- 1. Tenants
CREATE TABLE tenants (
  id             UUID PRIMARY KEY,
  name           TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Users
CREATE TABLE users (
  id             UUID PRIMARY KEY,
  clerk_id       TEXT UNIQUE NOT NULL,
  tenant_id      UUID REFERENCES tenants(id) NOT NULL,
  email          TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Events
CREATE TABLE events (
  id             UUID PRIMARY KEY,
  tenant_id      UUID REFERENCES tenants(id) NOT NULL,
  name           TEXT NOT NULL,
  description    TEXT,
  start_time     TIMESTAMPTZ NOT NULL,
  end_time       TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Payments
CREATE TABLE payments (
  id             UUID PRIMARY KEY,
  tenant_id      UUID REFERENCES tenants(id) NOT NULL,
  user_id        UUID REFERENCES users(id) NOT NULL,
  stripe_session_id TEXT UNIQUE NOT NULL,
  amount         INTEGER NOT NULL,
  status         TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tickets
CREATE TABLE tickets (
  id             UUID PRIMARY KEY,
  tenant_id      UUID REFERENCES tenants(id) NOT NULL,
  event_id       UUID REFERENCES events(id) NOT NULL,
  user_id        UUID REFERENCES users(id) NOT NULL,
  payment_id     UUID REFERENCES payments(id) NOT NULL,
  qr_code_data   TEXT NOT NULL,
  used           BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Gate Logs
CREATE TABLE gate_logs (
  id             UUID PRIMARY KEY,
  tenant_id      UUID REFERENCES tenants(id) NOT NULL,
  ticket_id      UUID REFERENCES tickets(id) NOT NULL,
  scanned_at     TIMESTAMPTZ DEFAULT NOW(),
  scanner_id     TEXT,
  result         TEXT NOT NULL  -- e.g., 'valid', 'invalid', 'already_used'
);
```

## 4. API Design and Endpoints

We follow a RESTful approach using Next.js API Routes within `app/api/tenants/[tenantId]/…`. All paths require a valid JWT and a matching `tenantId` in the URL.

### Key Endpoint Groups

1. Tenants
   • GET `/api/tenants/` – List available tenants (admin only)
   • POST `/api/tenants/` – Create a new tenant
   • GET `/api/tenants/{tenantId}` – Get tenant details
   • PATCH `/api/tenants/{tenantId}` – Update tenant metadata
   • DELETE `/api/tenants/{tenantId}` – Remove a tenant

2. Events
   • GET `/api/tenants/{tenantId}/events/` – List events
   • POST `/api/tenants/{tenantId}/events/` – Create an event
   • GET `/api/tenants/{tenantId}/events/{eventId}` – Event details

3. Tickets
   • POST `/api/tenants/{tenantId}/tickets/purchase` – Start a Stripe Checkout session for a ticket purchase
   • GET `/api/tenants/{tenantId}/tickets/{ticketId}` – Retrieve ticket info and QR data

4. Validation & Gate Logging
   • POST `/api/tenants/{tenantId}/tickets/{ticketId}/validate` – Check QR code, mark ticket used, and record in gate_logs
   • POST `/api/tenants/{tenantId}/gate/scan` – Public endpoint for gate hardware, secured by HMAC signature

5. Webhooks
   • POST `/api/webhooks/stripe` – Listen for `checkout.session.completed` events to update payment and ticket records

## 5. Hosting Solutions

• Frontend & API Routes: Vercel
  – Global CDN, automatic scaling, and zero-config deployments for Next.js
• Database: Supabase Cloud
  – Managed PostgreSQL with automated backups and RLS support
• File Storage (for PDFs or QR codes): Supabase Storage or S3-compatible bucket

Benefits:

- **Reliability:** Each service has built-in redundancy and uptime SLAs
- **Scalability:** Serverless functions on Vercel scale on demand; Supabase handles database growth
- **Cost-Effectiveness:** Pay only for what you use, with generous free tiers and predictable metered usage

## 6. Infrastructure Components

• Load Balancer & CDN
  – Vercel automatically routes traffic to the nearest edge location
• Caching
  – Next.js edge caching for SSR/SSG pages
  – HTTP cache headers on API responses where appropriate
• Real-Time & Edge Functions
  – Supabase real-time subscriptions for live dashboards
  – Optional Next.js Edge Functions for low-latency operations (e.g., QR code validation)
• Storage
  – Supabase Storage for ticket PDFs and QR code images, served via CDN

These components work together to deliver fast page loads, quick API responses, and reliable file delivery to users worldwide.

## 7. Security Measures

• Authentication & Authorization
  – Clerk handles sign-ups, logins, and issues JWT tokens
  – A Next.js middleware verifies the JWT and extracts `tenantId` and `userId`
• Database Security
  – Row-Level Security (RLS) policies in PostgreSQL ensure tenants only access their own rows
  – Environment variables store secrets (database URLs, Stripe keys, Clerk API keys)
• Data Encryption
  – All traffic uses HTTPS/TLS
  – Supabase encrypts data at rest
• Webhook & Gate Scanner Security
  – Stripe webhooks are verified via signature secret
  – Gate scanner endpoint uses HMAC signing to prevent unauthorized scans

## 8. Monitoring and Maintenance

• Logging & Error Tracking
  – Integrate Sentry (or Datadog) for capturing exceptions in API routes and edge functions
  – Use Vercel Analytics for request metrics and latency tracking
• Database Monitoring
  – Supabase provides query performance insights and automatic alarms
• CI/CD Pipeline
  – GitHub Actions runs lint, tests, and deploys to Vercel on merge to `main`
  – Migrations are automatically applied to Supabase on deployment
• Maintenance Strategies
  – Regular dependency audits (e.g., `npm audit`)
  – Periodic reviews of RLS policies and access logs
  – Scheduled database vacuuming and index optimizations handled by Supabase

## 9. Conclusion and Overall Backend Summary

This multi-tenant ticketing backend combines the power of Next.js 14 API Routes, Clerk authentication, Supabase-managed PostgreSQL with RLS, and Stripe payments into a single, highly scalable codebase. Key benefits include:

- **True Multi-Tenancy:** Securely isolate each tenant’s data without provisioning separate databases or servers.
- **Unified Development:** A single repository for frontend and backend code, sharing types and utilities.
- **Performance & Reliability:** Serverless functions, edge caching, and managed services ensure fast responses and high uptime.
- **Extensibility:** Modular utilities for QR/PDF generation, AI features via OpenAI, and real-time updates via Supabase.

With this setup, your team can focus on building event-specific features—like customized ticket designs or analytics dashboards—while relying on a rock-solid backend foundation that’s ready for production.
