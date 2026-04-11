# APSOparts Marketing Hub — Security Infrastructure

**Status:** Draft for Group Security review
**Owner:** APSOparts Marketing / Angst+Pfister Group IT Security
**Related document:** `TECHNICAL-ROADMAP.md`

---

## 1. Guiding security principles

The hub is designed around seven non-negotiable principles.

1. **Least privilege** — every integration, user role and API key has the narrowest possible scope.
2. **Read-before-write** — all corporate data integrations are read-only by default; write access is opt-in, per integration, per security review.
3. **Additive never destructive** — the hub can be disconnected at any moment without affecting source systems.
4. **Server-side secrets only** — no API keys, tokens or credentials ever reach the browser.
5. **Human in the loop** — every AI-generated output requires explicit human approval before leaving the hub.
6. **Auditability** — every prompt, response, approval, rejection and configuration change is logged for 24 months minimum.
7. **Phase-gated trust** — infrastructure privileges expand only after each phase clears a security review.

---

## 2. Authentication

The hub uses **Microsoft Entra ID** (formerly Azure Active Directory) as the identity provider. Because Angst+Pfister and APSOparts already run Microsoft 365 (Outlook, Teams, SharePoint), the hub joins the same Single Sign-On umbrella — no new identity system, no parallel MFA enrolment, no duplicate password. Users click "Sign in with Microsoft", authenticate against the Angst+Pfister tenant with their usual corporate credentials, MFA is enforced by the existing Conditional Access policy, and the hub receives a short-lived session cookie. The hub never sees or stores the user's password.

### OAuth implementation specifics

| Setting | Value |
|---|---|
| Library | NextAuth.js (Auth.js v5) |
| Identity provider | Microsoft Entra ID (Azure AD) — Angst+Pfister tenant |
| Tenant restriction | Single-tenant app registration in the Angst+Pfister Microsoft 365 tenant; users from any other tenant are rejected by Microsoft before the callback is even called |
| Allowed email domains | `@angst-pfister.com`, `@apsoparts.com` — additional server-side check as a second line of defence |
| Flow | Authorization Code with PKCE |
| Token storage | Server-side session, never stored in browser localStorage or sessionStorage |
| Session cookie | `httpOnly`, `secure`, `sameSite=lax`, 12-hour sliding expiry |
| MFA | Enforced at the Microsoft 365 tenant level via Conditional Access (same policy as Outlook) |
| Logout | Clears hub session + redirects to `login.microsoftonline.com/common/oauth2/logout` for full sign-out |
| CSRF protection | Built into NextAuth — double-submit cookie pattern |
| App registration owner | Angst+Pfister IT (creates the Entra ID app registration and shares the Client ID + Secret with the development team via secure channel) |

### OAuth for service accounts (Phase 2 read-only integrations)

Each corporate integration (GA4, GSC, Magento, LinkedIn, HubSpot) uses its own OAuth credential with the **minimum read-only scope**:

| Integration | OAuth scope | Purpose |
|---|---|---|
| Google Analytics 4 | `https://www.googleapis.com/auth/analytics.readonly` | Read traffic, sessions, conversions |
| Google Search Console | `https://www.googleapis.com/auth/webmasters.readonly` | Read queries, impressions, clicks, positions |
| Magento REST | Custom read-only API user (`catalog:read`) | Read product catalog for content grounding |
| LinkedIn Marketing | `r_organization_social`, `r_1st_connections_size` | Read organic post analytics (no write) |
| HubSpot | `content` (read/write on allow-listed properties only), `reports` (read) — NO `contacts` scope, NO `crm.objects.*` scope | Read campaign performance, create and update draft campaigns on a pre-approved narrow set of properties (campaign title, subject, preview text, body, scheduled date). No personal contact data, no Deals, no Companies. |
| Anthropic Claude | API key (not OAuth) | Content generation |
| Google Gemini | API key (not OAuth) | Content generation |

**Important on HubSpot:** the hub has write access only to a narrow allow-list of campaign properties (campaign title, subject line, preview text, body, scheduled date). The `contacts` scope and any scope on the Contacts, Deals or Companies objects are deliberately **excluded**. This means the hub never reads individual email addresses, names, phone numbers or any other personal field — only campaign-level aggregates (open rate, click rate, bounce rate, unsubscribe rate) and the campaign drafts themselves. The **send action always stays manual** inside HubSpot: marketing reviews and clicks Send in HubSpot, never from the hub. This keeps the hub outside the scope of HubSpot-stored personal data.

All OAuth refresh tokens are stored in **AWS Secrets Manager** (Phase 2) or **Railway environment variables** (Phase 1), never in the database or source code.

---

## 3. Authorization (who can do what)

Three roles, defined in the database and enforced on every API route.

| Role | Can view | Can generate | Can approve | Can schedule | Can manage KB | Can manage users |
|---|---|---|---|---|---|---|
| **Viewer** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Editor** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Approver** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Role assignment is done by an Admin in the hub's Settings page and requires Group IT approval for any new Admin.

---

## 4. Secrets management

### Phase 1 (Railway)

| Secret | Where | Rotation |
|---|---|---|
| `ANTHROPIC_API_KEY` | Railway environment variable | Quarterly |
| `GEMINI_API_KEY` | Railway environment variable | Quarterly |
| `NEXTAUTH_SECRET` | Railway environment variable | On incident only |
| `AZURE_AD_CLIENT_ID` / `AZURE_AD_CLIENT_SECRET` / `AZURE_AD_TENANT_ID` (if OAuth added in P1) | Railway environment variable | Quarterly; tenant ID is not secret but kept with the other values |

**Hard rules:**
- No `NEXT_PUBLIC_*` prefix on any secret — that prefix bundles the value into browser JS.
- No secrets in source code, `.env` files committed to git, Docker images, CI logs, or Slack.
- `.gitignore` excludes `.env`, `.env.local`, `.env.*.local` (verified in repo).

### Phase 2 (AWS)

| Secret | Where | Rotation |
|---|---|---|
| All API keys | AWS Secrets Manager (encrypted with KMS CMK) | Automated 90-day rotation where provider supports |
| Database credentials | RDS-managed secret in Secrets Manager | 30-day rotation |
| OAuth refresh tokens | Secrets Manager, one entry per user | Auto-refreshed by NextAuth |
| TLS certificates | AWS Certificate Manager | Automated renewal |

IAM policies restrict Secrets Manager access to the ECS task role only. No human has console access to production secrets — only via break-glass procedure logged to CloudTrail.

---

## 5. Network security

### Phase 1
- HTTPS / TLS 1.3 enforced by Railway edge
- HTTP Strict Transport Security (HSTS) header, 1-year max-age, includeSubDomains, preload
- No public database (no database at all in Phase 1)
- Outbound egress limited in-code to: `api.anthropic.com`, `generativelanguage.googleapis.com`, `accounts.google.com` (if OAuth), and the self-hosted font / image origin

### Phase 2
- Application runs inside a VPC with private subnets
- Application Load Balancer in public subnet is the only internet-facing component
- AWS WAF attached to the ALB with:
  - AWS Managed Rules — Core Rule Set (OWASP Top 10)
  - AWS Managed Rules — Known Bad Inputs
  - Rate-limiting rule: 1000 requests / 5 min per IP
  - Geo-blocking (optional, configurable)
- NAT Gateway for outbound traffic, all egress logged to VPC Flow Logs
- Security groups restrict port exposure to 443 only on the ALB

---

## 6. HTTP security headers

Set on every response (both phases):

| Header | Value | Why |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.anthropic.com https://generativelanguage.googleapis.com; frame-ancestors 'none'` | Prevent XSS, clickjacking, untrusted content |
| `X-Frame-Options` | `DENY` | Backup against clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing attacks |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disable unused browser APIs |

---

## 7. API security

Every API route (including `/api/generate`) passes through the same middleware chain:

```
Request
  │
  ▼
1. TLS termination (Railway / ALB)
  │
  ▼
2. WAF filtering (Phase 2)
  │
  ▼
3. Auth check — getServerSession() → 401 if missing/invalid
  │
  ▼
4. Role check — is this role allowed on this route? → 403 if not
  │
  ▼
5. Rate limit — per user, per route → 429 if exceeded
  │     (Phase 1: in-memory; Phase 2: Redis / ElastiCache)
  │
  ▼
6. Input validation — Zod schema → 400 if invalid
  │
  ▼
7. Business logic — call Claude / Gemini / read APIs
  │
  ▼
8. Output sanitization — strip unexpected HTML, validate shape
  │
  ▼
9. Audit log entry written
  │
  ▼
Response
```

### Rate limits

| Route | Limit | Rationale |
|---|---|---|
| `/api/generate` | 20 req / min / user | Prevent runaway Claude costs |
| `/api/auth/*` | 10 req / min / IP | Brute force protection |
| All other routes | 100 req / min / user | General abuse protection |

---

## 8. Data protection & GDPR

### Data residency
- Phase 1: Railway EU region (Frankfurt / Amsterdam / Paris)
- Phase 2: AWS eu-central-1 (Frankfurt) or eu-west-3 (Paris)
- Claude and Gemini API calls are documented in the ROPA as necessary processing activities. Only prompts containing public APSOparts content are sent; no personal data is included.
- Gemini API calls processed in the EU where available — configured via the `location` parameter

### Personal data
- **Phase 1:** No personal data. Only marketer identities (email, name) for login.
- **Phase 2:** No customer personal data. Marketer identities + read-only analytics aggregates from GA4 / GSC (which are already anonymized in Google's products).
- **No PII ever flows through the AI prompts.** Input validation strips anything matching email, phone, address, or ID-number patterns before sending to Claude or Gemini.

### Zero-retention AI
- Anthropic Claude commercial API — no prompt logging for training
- Google Gemini API — no prompt logging for training (enabled via API configuration)

### Images
- All product and content images used in drafts are generated in-house by the Gemini image generation API. No external image hotlinking, no third-party stock photo libraries, no customer or product photography from external vendors.

### GDPR documentation
- **DPIA** (Data Protection Impact Assessment) required before Phase 2 go-live
- **ROPA** (Record of Processing Activities) entry for the hub and each integration
- **DSR** (Data Subject Request) procedure: deletion of a marketer account removes their audit log entries after the legal retention window

---

## 9. Audit logging

Every action is logged to a dedicated audit trail.

| Event | Logged fields | Retention |
|---|---|---|
| User login / logout | User, timestamp, IP, user agent, success/failure | 24 months |
| AI content generation | User, timestamp, channel, topic, model, prompt, response, token count | 24 months |
| Content approval | User, timestamp, item ID, decision, notes | 24 months |
| Content rejection | User, timestamp, item ID, reason | 24 months |
| Knowledge base upload | User, timestamp, file name, size, hash | 24 months |
| Settings change | User, timestamp, setting, before/after values | 24 months |
| Integration (read) call | Timestamp, target, scope, response status | 12 months |
| Failed access attempt | Timestamp, IP, target resource, reason | 24 months |

**Phase 1:** audit log stored in application log stream (Railway log retention, exported weekly to internal storage).
**Phase 2:** audit log stored in PostgreSQL `audit_log` table + shipped to CloudWatch Logs with 24-month retention and optional S3 archive for long-term compliance.

Logs are **append-only** (no UPDATE or DELETE permission for the application role). The Audit & Compliance page in the hub surfaces the logs read-only for the Approver and Admin roles.

---

## 10. Dependency and supply-chain security

| Measure | Tool / process |
|---|---|
| Dependency audit | `npm audit` on every CI run — critical/high block merge |
| Lockfile | `package-lock.json` committed — reproducible builds |
| Minimal dependencies | Current footprint is ~15 top-level dependencies, reviewed manually |
| License review | Permissive licenses only (MIT, Apache 2.0, BSD) — verified on each upgrade |
| Renovate / Dependabot | Weekly automated PRs for security patches |
| Container scanning (Phase 2) | AWS ECR image scanning enabled |
| Source code scanning | GitHub Advanced Security / CodeQL on every push to main |

---

## 11. Incident response

### Detection
- Sentry (or equivalent) for application-level error alerting
- CloudWatch alarms on anomalous rates (Phase 2): 5xx spike, 4xx spike, request rate spike, unusual egress
- Weekly manual review of audit logs during Phase 1

### Response plan

| Severity | Definition | Response time | Actions |
|---|---|---|---|
| **P0 — Critical** | Active data exposure, credential compromise, successful unauthorized write | 15 minutes | Rotate all secrets immediately, disable affected integration, Group IT Security notified, post-mortem within 48h |
| **P1 — High** | Service fully down, authentication bypass suspected | 1 hour | Disable public access, investigate, notify stakeholders |
| **P2 — Medium** | Degraded service, individual feature broken | 4 hours | Fix forward or roll back |
| **P3 — Low** | Cosmetic issue, non-security bug | Next business day | Track in backlog |

### Breach notification (GDPR Art. 33)
- 72-hour notification to the Data Protection Authority if a personal data breach is confirmed
- Documented breach playbook maintained by Group IT Security

---

## 12. Penetration testing and audits

| Activity | Frequency | When |
|---|---|---|
| Internal code review | On every pull request | Continuous |
| Automated dependency scan | On every CI run | Continuous |
| External penetration test | Once before Phase 2 go-live, then annually | Before Phase 2 |
| GDPR internal audit | Annually | Phase 2 onwards |
| Secrets rotation drill | Quarterly | Phase 2 onwards |
| Disaster recovery drill | Annually | Phase 2 onwards |

---

## 13. Per-phase security requirements checklist

### Phase 1 gate (before agency hosts it)
- [ ] This document and the Technical Roadmap reviewed and signed by Group Security
- [ ] Agency provides SOC 2 Type II report or equivalent attestation
- [ ] Railway EU region confirmed in writing
- [ ] Anthropic and Google Gemini contracts include GDPR Standard Contractual Clauses
- [ ] `.env.example` documented, no real secrets in git, `.gitignore` verified
- [ ] Only public content in the knowledge base
- [ ] Written confirmation that no write-capable integration is present

### Phase 2 gate (before AWS migration)
- [ ] All Phase 1 items still valid
- [ ] DPIA completed and approved
- [ ] ROPA entry added
- [ ] AWS account, VPC, IAM roles, Secrets Manager configured via code (Terraform / CDK)
- [ ] Penetration test report with no critical or high findings
- [ ] Microsoft Entra ID (Azure AD) SSO enforced, Conditional Access MFA verified against the Angst+Pfister tenant
- [ ] Read-only API credentials provisioned by Group IT for each integration
- [ ] Incident response plan accepted by Group IT Security
- [ ] Backup and restore procedure tested

### Phase 3 gate (per write-integration)
- [ ] Business case documented (value vs. risk)
- [ ] Dual-control approval flow implemented in code
- [ ] Scope limited to the minimum necessary write permissions
- [ ] Incident rollback procedure tested
- [ ] Independent security sign-off on the specific integration

---

## 14. Review cadence

This document is maintained by the APSOparts Marketing project owner together with the external agency technical lead. It is reviewed at the start of every phase transition and whenever a new integration is proposed. Any material change to authentication, integration scope or data handling requires a new review by Group Data Security before the change goes live.
