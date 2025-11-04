# Frontend Guideline Document

This document lays out the key architecture, design rules, and technologies behind the `codeguide-multitenant-ticketing` frontend. It’s written in everyday language so everyone—from designers to new developers—can understand how our ticketing SaaS app is built and maintained.

## 1. Frontend Architecture

### 1.1 Technology Stack
- **Next.js 14 (App Router)**: The heart of our app. Handles page rendering (SSR and SSG), file-based routing, and built-in API routes under `app/api/`.  
- **TypeScript**: All code is typed. This catches errors early and makes components easier to refactor.  
- **Clerk**: Manages user sign-up, login, sessions, and issues JWTs for secure API calls.  
- **Supabase**: Provides a managed PostgreSQL database with row-level security (RLS). We use it for data storage, real-time updates, and file storage.  
- **Stripe**: Handles one-time payments for tickets. Webhooks update our `payments` table automatically.  
- **TanStack React Query**: Fetches, caches, and synchronizes server data in the UI.  
- **React Hook Form & Zod**: Builds and validates forms (like the ticket purchase form).  
- **Tailwind CSS** + **shadcn/ui**: Utility-first styling plus a library of ready-made components for fast, consistent UIs.  

### 1.2 How the Architecture Supports Key Goals
- **Scalability**:  
  • File-based API routes keep backend logic alongside the frontend—no separate server to manage.  
  • Supabase RLS lets us serve many tenants from one database, avoiding the overhead of separate schemas.  
- **Maintainability**:  
  • TypeScript and clear folder structure separate components, utilities, and API logic.  
  • Atomic component design (atoms, molecules, organisms) helps teams add or update UI pieces without side effects.  
- **Performance**:  
  • Next.js SSR/SSG ensures pages load fast and are indexed by search engines.  
  • React Query caches data and minimizes unnecessary network calls.  
  • Tailwind’s JIT mode only ships the CSS you actually use.  

## 2. Design Principles

### 2.1 Usability
- Use familiar UI patterns (forms, buttons, dropdowns).  
- Provide clear feedback on actions (loading spinners, success/error messages).  

### 2.2 Accessibility
- Follow WCAG guidelines: semantic HTML, meaningful alt text, sufficient color contrast.  
- Every interactive element is keyboard-navigable and screen-reader friendly using ARIA where needed.  

### 2.3 Responsiveness
- Design mobile-first with Tailwind breakpoints (`sm`, `md`, `lg`, `xl`).  
- Layouts and components adapt fluidly from phones to large desktops.  

### 2.4 Consistency
- A single source of truth for colors, spacings, and typography via `tailwind.config.js`.  
- Reusable component library (shadcn/ui) ensures a uniform look across screens.  

## 3. Styling and Theming

### 3.1 Styling Approach
- **Utility-First (Tailwind CSS)**: We use Tailwind classes directly in JSX to style elements.  
- **Minimal Custom CSS**: Reserved for global overrides or unique animations.  

### 3.2 Theming
- Light and dark modes enabled via the `class` strategy in Tailwind.  
- Theme switch is stored in local storage and applied at the root `<html>` level.  

### 3.3 Visual Style
- **Modern Flat Design**: Clean shapes, generous white space, and simple iconography.  
- **Subtle Glassmorphism**: Panels and modals have a semi-transparent backdrop with light blur for a polished look.  

### 3.4 Color Palette
| Role         | Hex       | Purpose                                 |
|--------------|-----------|-----------------------------------------|
| Primary      | #3B82F6   | Buttons, links, active states           |
| Secondary    | #2563EB   | Hover states, highlights                |
| Accent       | #F59E0B   | Callouts, badges                        |
| Neutral Dark | #1F2937   | Text, icons                             |
| Neutral Light| #F3F4F6   | Backgrounds, cards                      |
| Error        | #DC2626   | Validation messages, destructive actions|

### 3.5 Typography
- **Font Family**: Inter (system-fallback: `-apple-system, BlinkMacSystemFont, sans-serif`).  
- **Scale**: `text-base` (16px), `text-sm` (14px), `text-lg` (18px), heading sizes from `text-2xl` to `text-5xl`.  

## 4. Component Structure

We follow an **atomic design** pattern inside `components/`:

- **Atoms**: Basic elements (Button, Input, Avatar).  
- **Molecules**: Combinations of atoms (SearchBar, TicketCard).  
- **Organisms**: Full sections (Header, TenantSelector).  
- **Templates/Pages**: Layouts and actual routes under `app/`

Each component folder contains:
- `index.tsx` for the component
- `styles.ts` or a `.css` file if needed
- `__tests__/` for component tests

Benefits:
- Easy to find and update UI pieces
- Encourages reusability, reducing duplication
- Simplifies onboarding for new team members

## 5. State Management

### 5.1 Server State
- **TanStack React Query** handles all data fetching, caching, and background updates.  
  • Queries live close to the component that needs them.  
  • Mutations update cache and trigger refetches automatically.  

### 5.2 Client State
- **React Context** for cross-app values like the current `tenantId` and theme.  
- Local component state (via `useState`) for transient UI state (modals, inputs).  

### 5.3 Why This Approach?
- Clear separation between server and client state.  
- React Query minimizes manual loading and error handling.  
- Context API keeps global values in one place without adding extra libraries.  

## 6. Routing and Navigation

### 6.1 Next.js App Router
- Folder structure under `app/` defines both pages and API routes.  
- Dynamic segments: `/app/tenants/[tenantId]/tickets` automatically maps to `pages` and `layout.tsx`.  

### 6.2 Nested Layouts
- Common UI (sidebar, header) lives in `layout.tsx` at the root and deeper folders, reducing repetition.  

### 6.3 Navigation Components
- Use Next.js `<Link>` for client-side transitions.  
- Active links styled via Tailwind utility classes.  

### 6.4 Route Protection
- `middleware.ts` inspects JWTs from Clerk and ensures users belong to the correct tenant.  
- Unauthenticated or unauthorized users get redirected to sign-in.

## 7. Performance Optimization

- **Server-Side Rendering (SSR) & Static Generation (SSG)** via Next.js for fast first loads.  
- **Code Splitting & Lazy Loading**: Next.js automatically splits code by route; use `dynamic()` for large components.  
- **Image Optimization**: Use `<Image>` from `next/image` for responsive, lazy-loaded images.  
- **Caching**: React Query caches data and minimizes refetching.  
- **Asset Minification**: Vercel and Next.js handle JS/CSS minification and compression.  

## 8. Testing and Quality Assurance

### 8.1 Unit Tests
- **Jest** + **@testing-library/react** for components and utility functions (`utils/qrcodeGenerator`).  
- Aim for >80% coverage on core logic (payment processing, QR code generation).  

### 8.2 Integration Tests
- Test form workflows (e.g., `TicketPurchaseForm`) and API interactions by mocking fetch calls.  

### 8.3 End-to-End (E2E) Tests
- **Playwright** or **Cypress** to simulate real user flows:   
  1. Sign up via Clerk.  
  2. Select tenant.  
  3. Purchase ticket.  
  4. Download PDF and scan QR with the gate scanner.  

### 8.4 Continuous Integration
- GitHub Actions runs lint, type checks, tests, and deploys on push to `main`.  

## 9. Conclusion and Overall Frontend Summary

This frontend setup is a modern, full-stack solution built on Next.js 14, TypeScript, and a suite of well-integrated services: Clerk for auth, Supabase for data, Stripe for payments, and Tailwind for styling. It’s designed for multi-tenant SaaS ticketing—fast to develop, easy to maintain, and ready to scale. Key highlights:

- Unified codebase: frontend and backend logic live together.
- True multi-tenancy with Supabase RLS and Clerk JWTs.
- Component-driven, type-safe, and testable.
- Built-in performance and accessibility best practices.

With these guidelines, any team member can confidently understand, build on, and extend the frontend of our multi-tenant ticketing system.