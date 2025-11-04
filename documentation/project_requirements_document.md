# Project Requirements Document (PRD)

## 1. Project Overview

**Codeguide-Multitenant-Ticketing** is a starter template built with Next.js 14 (App Router) that kickstarts the development of a multi-tenant online ticketing SaaS application. It brings together modern tools—Clerk for authentication, Supabase for database management, Stripe for payments, and Tailwind CSS + shadcn/ui for UI—to solve the repetitive setup effort required when building a ticketing system that serves multiple independent event organizers (tenants) from a single codebase.

This template exists to dramatically reduce time-to-market and enforce best practices out of the box. Key objectives include:

- Enable **tenant onboarding** so each event organizer has isolated data and branding.
- Manage **ticket sales** via Stripe with one-time payments.
- Generate and validate **QR code tickets** at entry points.
- Record every scan in a **gate logging** table for security and analytics.

Success is measured by a working first release where an organizer can sign up, create events, sell tickets, scan QR codes at the gate, and view logs—all using the same running application instance.

---

## 2. In-Scope vs. Out-of-Scope

### In-Scope (Version 1)

- Tenant management: signup, profile, and data isolation via Supabase Row-Level Security (RLS).
- User authentication & authorization through Clerk (JWT-based API protection).
- Event creation and listing.
- Ticket purchase flow using Stripe Checkout Sessions (one-time payments).
- QR code generation (using a library like `qrcode`) and embedding in a downloadable PDF.
- Gate scanner component (e.g., `react-qr-reader`) to validate tickets via API.
- Gate logging: recording each scan attempt with timestamp and result.
- Supabase migrations for tables: `tenants`, `events`, `tickets`, `payments`, `gate_logs`.
- Basic AI integration placeholder for event description generation (OpenAI API).

### Out-of-Scope (Later Phases)

- Recurring subscription plans for organizers or attendees.
- Native mobile application (iOS/Android) or offline-first support.
- Multi-language/internationalization.
- Advanced analytics dashboards or reporting beyond raw gate logs.
- Social or email marketing integrations.
- Real-time seat allocation or map-based venue layouts.

---

## 3. User Flow

When a new event organizer arrives, they sign up with their email via the Clerk-powered signup page. After verifying their account, they land on a dashboard where they can create and manage events. Each event entry form captures title, description, date/time, and ticket price. Once an event is live, a public listing page displays available events and a “Buy Ticket” form.

A buyer selects an event, fills in their details, and completes payment via Stripe Checkout. On successful payment, the system issues a ticket record, generates a QR code and a PDF ticket URL, and sends it back to the user. At the venue entrance, a gate agent opens the Gate Scanner page, scans the attendee’s QR code, and the system validates the ticket, marks it as used, and logs the scan in the `gate_logs` table. Both successful and failed scans return clear feedback on-screen.

---

## 4. Core Features

- **Multi-Tenant Isolation**: Record `tenant_id` on every data table; enforce with Supabase RLS.
- **Authentication & Authorization**: Clerk for signup/login; JWT middleware in `middleware.ts`.
- **Event Management Module**: CRUD events API routes under `/api/tenants/[tenantId]/events`.
- **Ticket Purchase Module**: Checkout session creation, payment confirmation webhook, ticket record insertion.
- **QR Code & PDF Generator**: Utility to produce QR data URLs and PDF tickets.
- **Gate Scanner Component**: Frontend component to read QR codes and call validation endpoint.
- **Gate Logging Service**: API route to record scan results (`valid`, `already_used`, `invalid`).
- **Supabase Migrations**: SQL files for all required tables and RLS policies.
- **AI Utility Stub**: Placeholder to call OpenAI for generating event descriptions.

---

## 5. Tech Stack & Tools

- **Framework**: Next.js 14 (App Router) for SSR, API routes, and file-based routing.
- **Language**: TypeScript for type safety.
- **Authentication**: Clerk (manages users, sessions, issues JWTs).
- **Database**: Supabase (PostgreSQL) with RLS, migrations, real-time features.
- **Payment Processing**: Stripe (Checkout Sessions, webhooks).
- **UI & Styling**: Tailwind CSS + shadcn/ui components.
- **State & Data Fetching**: TanStack React Query.
- **Form Handling & Validation**: React Hook Form + Zod.
- **QR Code Lib**: `qrcode` (generates QR image data URLs).
- **PDF Generation**: `pdf-lib` or Puppeteer (server-side PDF creation).
- **AI Integration**: OpenAI API (e.g., GPT-4 for text generation).
- **Dev Tools**: ESLint, Prettier, VS Code (with Cursor AI or Windsurf plugin if desired).

---

## 6. Non-Functional Requirements

- Performance: Page load times under 1 second for event listing; API endpoints respond within 200ms under light load.
- Scalability: Support thousands of tenants and events; use serverless functions or edge handlers for peak traffic.
- Security:
  - TLS/HTTPS for all endpoints.
  - JWT verification in middleware.
  - Supabase RLS policies to isolate tenant data.
  - HMAC verification on gate scan webhook (if integrating an external gate device).
- Compliance:
  - PCI DSS compliance for Stripe-based payments.
  - GDPR-friendly data handling (user consent for cookies).
- Usability:
  - Responsive design for desktop/tablet/mobile.
  - Clear error messages on form validation and scan results.

---

## 7. Constraints & Assumptions

- Assumes you have active accounts and API keys for Clerk, Supabase, Stripe, and OpenAI.
- Relies on Next.js App Router and Node.js 18+ runtime on the deployment platform (e.g., Vercel).
- Assumes RLS-based multi-tenancy is acceptable; schema-per-tenant is not implemented.
- Assumes basic PDF generation is sufficient; large-scale or high-fidelity designs may require external services.
- Assumes the gate scanner device can run a modern web browser to load the Gate Scanner page.

---

## 8. Known Issues & Potential Pitfalls

- **Supabase RLS Misconfiguration**: Incorrect policies can expose data across tenants. Mitigation: write policy tests and enforce CI checks.
- **Stripe Rate Limits**: Hitting API limits if many purchases occur simultaneously. Mitigation: implement exponential backoff and webhook retries.
- **PDF Generation Performance**: Generating large PDFs server-side can time out on serverless platforms. Mitigation: limit PDF size or offload to a background job.
- **QR Collision Risk**: Rare chance two tickets share the same QR payload. Mitigation: include a UUID and enforce uniqueness at the database level.
- **Gate Scanner Compatibility**: Mobile camera APIs vary across browsers. Mitigation: test on target devices and fall back to file upload of QR images.
- **Middleware Overhead**: Running heavy logic in `middleware.ts` can slow every request. Mitigation: keep middleware lean and cache tenant/session lookups.


*This PRD is designed to be the single source of truth for the AI model to generate subsequent technical documentation. Every requirement is spelled out to avoid ambiguity and ensure consistent implementation.*