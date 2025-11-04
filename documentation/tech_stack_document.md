# Tech Stack Document: codeguide-multitenant-ticketing

This document explains in plain English the technologies and tools we’ve chosen for the **codeguide-multitenant-ticketing** project—a starter template to build a modern, multi-tenant online ticketing SaaS system. Each section shows what we use and why, so you can understand how everything fits together.

---

## 1. Frontend Technologies

Our goal on the frontend is to give event organizers and attendees a smooth, responsive, and attractive interface. Here’s what we use:

- **Next.js 14 (App Router)**
  • Acts as our main framework for building pages and handling routing.  
  • Lets us do server-side rendering (SSR) for fast load times and better SEO.
  • Provides file-based API routes, so we can keep frontend and backend code in one place.

- **TypeScript**
  • Adds type checking to JavaScript, catching errors early and improving maintainability.

- **Tailwind CSS**
  • A utility-first CSS framework that speeds up styling by using small, composable classes.  
  • Ensures a consistent look without writing custom CSS from scratch.

- **shadcn/ui**
  • A pre-built component library (buttons, forms, modals, etc.) that matches Tailwind’s style, so everything looks cohesive.

- **TanStack React Query**
  • Manages data fetching and caching for API calls (e.g., loading events or tickets).  
  • Keeps UI in sync with server state without manual loading indicators.

- **React Hook Form + Zod**
  • Simplifies form management, validation, and error display (used in the ticket purchase form).  
  • Zod lets us define clear validation rules for form fields (dates, numbers, emails).

- **React QR Reader**
  • A React library to scan QR codes from a camera or image (used in the gate scanning component).

- **PDF and QR Code Libraries**  
  • **`qrcode`**: Generates QR code images for each ticket.  
  • **`pdf-lib`** or **Puppeteer**: Creates PDF tickets by embedding QR codes and event details.

---

## 2. Backend Technologies

On the server side, we need a reliable database, secure authentication, and payment processing. We keep everything inside Next.js API routes for simplicity.

- **Next.js API Routes**  
  • Folder: `app/api/` contains all our backend endpoints (e.g., tenant CRUD, ticket purchase, ticket validation).  
  • Benefits from the same languages, types, and deployment as the frontend.

- **Clerk (Authentication & Authorization)**  
  • Handles user sign-up, login, and session management (email/password + OAuth).  
  • Issues JWTs so we can protect API routes and ensure only authorized users from the right tenant can access data.

- **Supabase (PostgreSQL Database + Services)**  
  • Provides a managed PostgreSQL database with real-time subscriptions and built-in Row-Level Security (RLS).  
  • We store tenants, events, tickets, payments, and gate logs here.  
  • RLS policies make sure each tenant only sees their own data.

- **Stripe (Payment Processing)**  
  • Industry-standard for handling both one-time ticket purchases and subscription models.  
  • Our utility under `utils/stripe/` creates checkout sessions and listens to webhooks to track payment status.

- **OpenAI API (Optional AI Features)**  
  • Used to generate event descriptions, email copy, or chat-based support content automatically.

- **Business Logic Utilities**  
  • **`utils/qrcodeGenerator.ts`**: Encapsulates QR code creation.  
  • **`utils/pdfGenerator.ts`**: Handles PDF ticket assembly if using `pdf-lib` or Puppeteer.  
  • **`utils/supabase/`**: Contains helper functions for secure server-side database calls.

---

## 3. Infrastructure and Deployment

To keep deployments smooth and your app running 24/7, we chose cloud services and automated pipelines:

- **Vercel**  
  • Hosting platform optimized for Next.js projects—automatic builds and global CDN for fast page loads.

- **GitHub & GitHub Actions**  
  • Version control with GitHub repositories.  
  • CI/CD workflows that:
    - Run lint checks (ESLint) and type checks (TypeScript).
    - Run tests (unit, integration, and E2E).  
    - Deploy to Vercel on merge to main.

- **Supabase Migrations**  
  • SQL files under `supabase/migrations/` let you version-control your database schema (tenants, events, tickets, etc.).

- **Supabase Storage**  
  • Stores generated PDFs or other assets securely alongside the database.

- **Monitoring & Logging**  
  • **Sentry** or **Datadog** (recommended) to capture errors and performance metrics in real time.

---

## 4. Third-Party Integrations

We rely on several external services to streamline key features:

- **Clerk**: User management, authentication flows, and JWT issuance.
- **Supabase**: Database, real-time data, RLS, migrations, and file storage.
- **Stripe**: Payment gateway, checkout sessions, webhooks, and product management.
- **OpenAI**: AI-powered content generation (optional but ready to plug in).
- **Sentry / Datadog**: Error tracking and performance monitoring.

These integrations let us focus on building ticketing features instead of reinventing authentication, data storage, or payment handling.

---

## 5. Security and Performance Considerations

We’ve built in multiple layers of security and optimized for fast user experiences:

- **Authentication & Access Control**  
  • Clerk-issued JWTs protect all API routes.  
  • Next.js middleware (`middleware.ts`) checks tokens and tenant context on every request.
  • Supabase RLS policies enforce data isolation per tenant at the database level.

- **Data Validation**  
  • Zod schemas validate inputs in API routes to prevent bad or malicious data.

- **Encrypted Data Storage**  
  • Supabase ensures data at rest and in transit is encrypted by default.

- **Performance Optimizations**  
  • Server-Side Rendering (SSR) and Static Site Generation (SSG) for faster initial loads.  
  • React Query caches frequently accessed data (event lists, user tickets).  
  • Vercel’s global CDN and edge network reduce latency for users worldwide.

- **Secure Webhook Handling**  
  • Stripe webhooks are verified via signatures to prevent spoofed events.  
  • Gate scanner webhooks can use HMAC signing to secure ticket validation requests.

---

## 6. Conclusion and Overall Tech Stack Summary

We’ve chosen a modern, cohesive set of technologies that work hand-in-hand:

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, React Query, React Hook Form & Zod, QR reader.
- **Backend**: Next.js API Routes, Clerk for auth, Supabase (PostgreSQL + RLS + Storage), Stripe, OpenAI.
- **Infra/DevOps**: Vercel hosting, GitHub + GitHub Actions for CI/CD, Supabase migrations, Sentry/Datadog monitoring.
- **Utilities**: QR code and PDF generation libraries, custom Supabase & Stripe helper modules.

These choices make the codeguide-multitenant-ticketing template:

- **Easy to extend** for ticket purchases, validations, and gate logging.
- **Secure and isolated** for multiple event organizers in a single app instance.
- **Fast and reliable** thanks to server-side rendering, caching, and managed services.

With this tech stack, you have a solid foundation to build, customize, and scale your multi-tenant ticketing SaaS with confidence. Welcome aboard!