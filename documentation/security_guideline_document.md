# Security Guidelines for `codeguide-multitenant-ticketing`

This document outlines the security principles, controls, and best practices you must follow when building and extending the **Next.js 14 multi-tenant ticketing system**. It covers authentication, data protection, input validation, API hardening, infrastructure, and dependency management to ensure a secure-by-design application.

---

## 1. Security by Design & Principles

- **Embed security from day one**: Every new feature or change must consider threat modeling and secure design.
- **Least Privilege**: Grant each service, user, and component only the minimal permissions needed (e.g., RLS policies, narrow Stripe API scopes).  
- **Defense in Depth**: Apply security controls at multiple layers—frontend, API routes, database, infrastructure.  
- **Fail Securely**: On errors, avoid leaking stack traces or sensitive details. Use generic error messages client-side and detailed logs server-side.  
- **Secure Defaults**: Enable RLS in Supabase by default, force HTTPS, set strict HTTP headers, and disable debug in production.

---

## 2. Authentication & Access Control

### 2.1 Clerk & JWT

- Use Clerk for user registration, login, and session management.  
- Validate JWTs on every API route with Clerk’s middleware (`middleware.ts`).  
- Enforce `exp` and verify signatures; disallow the `none` algorithm.  
- Rotate signing keys periodically and store them securely in a secret manager.

### 2.2 Role-Based Access Control (RBAC)

- Define roles: **organizer**, **attendee**, **gate_scanner**, **admin**.  
- Perform server-side authorization in each API route before any business logic.  
- Map Clerk user metadata to roles and include in the JWT claims.

### 2.3 Session Management & MFA

- Enforce `Secure`, `HttpOnly`, and `SameSite=Strict` on session cookies.  
- Configure idle and absolute timeouts for sessions.  
- Offer Multi-Factor Authentication (MFA) via SMS or authenticator apps for organizers and admins.

---

## 3. Input Validation & Output Encoding

- **Zod schemas** for request bodies in every API route (`app/api/.../route.ts`).  
- Sanitize and whitelist allowed values for dynamic routes (e.g., `tenantId`, `ticketId`).  
- Use parameterized queries or Supabase client to prevent SQL injection.  
- Encode all user-supplied content before rendering in React components.  
- Validate file uploads (PDF templates, images): restrict types, max size, scan for malware.

---

## 4. Data Protection & Privacy

### 4.1 Encryption

- Enforce TLS 1.2+ for all frontend and API communication.  
- Ensure Supabase connections use SSL and enforce `rejectUnauthorized` on the client.  
- Encrypt sensitive columns at rest (e.g., payment metadata) using PostgreSQL `pgcrypto` if needed.

### 4.2 Secrets Management

- Store API keys, DB URLs, and Stripe secrets in a managed secrets store (e.g., AWS Secrets Manager, Vercel Environment).  
- Do **not** commit `.env` files or secret values to source control.

### 4.3 Logging & Error Handling

- Mask PII in logs; never log full JWTs, credit card details, or user passwords.  
- Capture errors with Sentry or Datadog—avoid leaking stack traces to clients.

---

## 5. API & Service Security

### 5.1 HTTPS & CORS

- Redirect all HTTP traffic to HTTPS.  
- Restrict CORS to known front-end origins; do not use wildcard (`*`).

### 5.2 Rate Limiting & Throttling

- Implement rate limits on critical endpoints (e.g., login, ticket purchase, gate scan).  
- Use an in-memory store (Redis) or third-party (Cloudflare Rate Limiting) to track request counts.

### 5.3 Versioning & Least Exposure

- Prefix API paths with versions (e.g., `/api/v1/tenants/...`).  
- Return only necessary fields in API responses; avoid exposing internal IDs or metadata.

### 5.4 Webhooks Security

- Verify Stripe webhook signatures using HMAC secrets.  
- Use replay protection by validating timestamps within an acceptable window.

---

## 6. Web Application Security

- **CSRF Protection**: Use anti-CSRF tokens for state-changing POST/PUT/DELETE requests.  
- **Security Headers**:
  - `Content-Security-Policy`: restrict scripts/styles to self and trusted CDNs.  
  - `Strict-Transport-Security`: enforce HTTPS.  
  - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin`.  
- **Subresource Integrity (SRI)** for any CDN-loaded assets.  
- Avoid storing sensitive tokens in `localStorage` or `sessionStorage`.

---

## 7. Infrastructure & Configuration

- Harden the Next.js hosting environment (e.g., Vercel) by disabling preview features and debugging in production.  
- Limit exposed ports—only 80/443 for HTTP(s).  
- Keep OS, Node.js, and dependencies up to date; automate patching where possible.
- Use infrastructure-as-code (Terraform/CloudFormation) with secure defaults and least privilege IAM roles.

---

## 8. Dependency Management

- Maintain `package-lock.json` and run `npm audit` in CI to detect known vulnerabilities.  
- Use Dependabot or Renovate to keep dependencies up to date.  
- Review third-party libraries for active maintenance and a clean security history.
- Remove unused packages to minimize the attack surface.

---

## 9. Testing & CI/CD Security

- **Automated Tests**: Unit, integration, and E2E tests must validate both functionality and security (e.g., unauthorized access attempts).  
- **CI Pipeline**: 
  - Run linting, type checks, and security scans (e.g., ESLint-plugin-security, npm audit) on every pull request.  
  - Do not deploy if any security checks fail.  
- **Deployment**: Use locked-down deploy keys and rotate them regularly.  

---

## 10. Monitoring & Incident Response

- Integrate real-time monitoring for API errors, latency, and security events (e.g., repeated 401s).  
- Define an incident response plan: alert on threshold breaches, document roles and escalation paths, and practice post-incident reviews.

---

By adhering to these guidelines, you will ensure that the **codeguide-multitenant-ticketing** application remains secure, maintainable, and resilient against evolving threats. Regularly review and update this document as new threats emerge and your application grows in complexity.
