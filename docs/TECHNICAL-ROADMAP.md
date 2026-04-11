# APSOparts Marketing Hub — Technical Roadmap

**Status:** Draft for Group Security review
**Owner:** APSOparts Marketing / Angst+Pfister Group IT
**Related document:** `SECURITY-INFRASTRUCTURE.md`

---

## 1. Project objective

Build an AI-assisted marketing operations hub for APSOparts that lets the marketing team generate, review, approve and schedule content (LinkedIn posts, newsletters, blog articles, SEO keyword research) with mandatory human approval gates and full audit traceability.

The hub is deployed in **three phases**, each unlocking more capability as security, infrastructure and organizational readiness allow.

---

## 2. Phased deployment strategy

### Phase 1 — Supervised training sandbox (external agency hosting)

**Goal:** Evaluate AI content generation quality against APSOparts brand, materials catalog and tone of voice, without touching any live corporate system or customer data.

**Hosting**
- Next.js 15 application deployed to **Railway** (EU region — Frankfurt / Amsterdam / Paris).
- Platform operated by the external digital agency on their corporate Railway account.
- HTTPS/TLS 1.3 enforced by Railway's edge layer.
- EU data residency confirmed and documented (Schrems II / GDPR Art. 44 compliance).

**Integrations (strictly limited)**
- ✅ **Anthropic Claude API** — content generation (primary model)
- ✅ **Google Gemini API** — alternative model for A/B quality comparison
- ❌ No Google Analytics 4
- ❌ No Google Search Console
- ❌ No Magento connection (product catalog stays manual / static)
- ❌ No LinkedIn, Newsletter or any publishing API
- ❌ No CRM / customer data

**Training inputs (fully controlled)**
- APSOparts public website copy (manually curated export)
- Public product catalog pages (manually curated export)
- Brand Guidelines v3.2 (PDF upload)
- Tone of Voice document (PDF upload)
- Technical datasheets for elastomers and engineered plastics (public datasheets only)
- Public SEO keyword list (from agency research, no GSC data)

All training material is **public content only** — nothing confidential, nothing customer-related, nothing internal.

**Workflow**
1. Marketing user drafts a topic prompt in the hub
2. Claude or Gemini generates a draft (LinkedIn / Newsletter / Blog)
3. Draft enters the approval queue
4. Marketing reviews, edits and approves
5. **Manual publishing** — user copy-pastes the approved content into the destination platform themselves (LinkedIn, Mailchimp, Magento CMS, etc.)

No outbound publishing automation whatsoever in Phase 1.

**Exit criteria to move to Phase 2**
- Minimum 4 weeks of active use
- ≥ 50 AI-generated drafts reviewed by marketing
- Quality score ≥ 85/100 average (measured against brand checklist)
- Security & Compliance sign-off on hosting migration to AWS EU

---

### Phase 2 — Secure corporate hosting with read-only integrations

**Goal:** Migrate to Angst+Pfister-controlled infrastructure and unlock real-time data insights while maintaining strict read-only access to corporate systems.

**Hosting migration**
- Redeploy to **AWS EU** (eu-central-1 Frankfurt preferred, or eu-west-3 Paris)
- Deployment target: AWS Elastic Container Service (ECS Fargate) or AWS App Runner, inside a VPC with private subnets
- Application Load Balancer with AWS Certificate Manager (TLS 1.3)
- Secrets stored in **AWS Secrets Manager**
- Logs shipped to **CloudWatch Logs** with 24-month retention
- Automated backups of application state (if persistent storage added)
- Infrastructure defined as code (Terraform / AWS CDK) and version-controlled
- DNS via Route 53, WAF rules for rate limiting and OWASP Top 10 protection

**New read-only integrations**
- ✅ Google Analytics 4 — **read-only** scope (`analytics.readonly`)
- ✅ Google Search Console — **read-only** scope (`webmasters.readonly`)
- ✅ Magento product catalog — **read-only** API user (catalog_read)
- ✅ LinkedIn Organic — **read-only** analytics scope (no posting)
- ❌ Still no write access to any publishing channel
- ❌ Still no customer / order / CRM data

**Authentication**
- Google Workspace OAuth 2.0 restricted to `@angst-pfister.com` / `@apsoparts.com` domains
- MFA enforced at the Google Workspace level
- Session tokens stored in secure, httpOnly, sameSite cookies
- 12-hour session timeout, sliding refresh

**New capabilities unlocked**
- Real traffic / keyword / ranking data on the SEO Command Center
- Real analytics on the Analytics page (no more sample data)
- Content performance feedback loop — the hub learns which topics/formats convert best
- Automatic detection of keyword cannibalization from actual rankings

**Exit criteria to move to Phase 3**
- Minimum 1 month of production usage on AWS
- Quantified baseline metrics (time-to-publish, approval rate, content quality scores)
- Marketing team feedback consolidated into a change list

---

### Phase 3 — Optimization & write-access (opt-in, case-by-case)

**Goal:** Act on marketing feedback, refine the model, and — only where the business case is clear and security approves — unlock selective write access for scheduled publishing.

**Improvements based on usage data**
- Re-prompt engineering based on reviewed drafts vs rejected drafts
- Fine-tune SEO keyword recommendations using 1 month of real GSC data
- Optimize the approval workflow steps based on actual bottlenecks
- Add industry-specific content templates (F&B, pharma, aerospace, automotive)
- Customer story / case study workflow
- Potential multi-language expansion (DE / FR / IT from English master)

**Potential write-access (subject to separate security review)**
- LinkedIn Organic posting — scheduled, human-approved posts only, signed with dual-control approval
- Newsletter dispatch via Mailchimp API — draft creation only, send action still manual
- Magento blog post publishing — draft creation only, publish action still manual

Each write integration requires an **independent security review and sign-off** before activation. The default stays read-only.

---

## 3. Technical stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript | Mature SSR framework, strong type safety, server components for security |
| UI | Material UI v6, Recharts, Outfit/Inter fonts (self-hosted) | Professional B2B look, GDPR-compliant font loading |
| Runtime | Node.js 20 LTS | Standard, long-term supported |
| AI providers | Anthropic Claude API + Google Gemini API | Dual-provider for redundancy and quality A/B |
| Auth (Phase 2+) | NextAuth.js (Auth.js v5) + Google Workspace SSO | Industry standard, minimal custom auth code |
| State | React Server Components + client state | No database required in Phase 1 |
| Persistence (Phase 2+) | AWS RDS PostgreSQL (14+) in private subnet | Managed, encrypted at rest, backup automation |
| Secrets | Railway env vars (Phase 1) → AWS Secrets Manager (Phase 2+) | Industry standard per-phase |
| CI/CD | GitHub Actions → Railway (Phase 1) → AWS ECR + ECS (Phase 2+) | Reproducible, auditable deployments |

---

## 4. Architecture overview

### Phase 1 architecture

```
User browser (Angst+Pfister employee)
        │  HTTPS (TLS 1.3)
        ▼
Railway EU edge (Frankfurt / Amsterdam)
        │
        ▼
Next.js application container
  ├─ Server components (protected logic)
  ├─ API routes (server-side only)
  └─ Static assets (images, fonts, self-hosted)
        │
        ├──► Anthropic Claude API (EU or US, HTTPS, server-side key)
        └──► Google Gemini API (EU, HTTPS, server-side key)
```

No other outbound connections.

### Phase 2 architecture

```
User browser
        │  HTTPS (TLS 1.3)
        ▼
AWS Route 53 ──► AWS WAF ──► Application Load Balancer
                                       │
                                       ▼
                         VPC (eu-central-1)
                         ├─ Public subnet: ALB
                         └─ Private subnet: ECS Fargate task
                                       │
                                       ├─► Secrets Manager (API keys)
                                       ├─► CloudWatch Logs (audit trail)
                                       ├─► RDS PostgreSQL (approval history, audit logs)
                                       │
                                       ├─► Anthropic Claude API
                                       ├─► Google Gemini API
                                       ├─► GA4 API (read-only)
                                       ├─► GSC API (read-only)
                                       ├─► Magento REST (read-only)
                                       └─► LinkedIn API (read-only)
```

All egress traffic through a NAT gateway, logged, and restricted by security group.

---

## 5. Data handling principles

1. **Public-only in Phase 1** — no customer PII, no order data, no pricing, no internal documents beyond what is already published on apsoparts.com.
2. **Read-only by default in Phase 2** — read scopes on every corporate integration; write scopes require separate sign-off.
3. **AI prompts are logged** — every prompt sent to Claude / Gemini is stored in the audit trail with user, timestamp, model and response. Used for compliance and quality review.
4. **Zero retention on AI providers** — Anthropic's API does not retain or train on commercial API traffic; Google Gemini API has an equivalent zero-retention mode which must be explicitly enabled in the API configuration.
5. **No data leaves the EU** except for the Claude / Gemini API calls themselves, which are documented as a necessary processing activity in the GDPR Record of Processing Activities (ROPA).

---

## 6. Deliverables per phase

### Phase 1 deliverables
- Deployed Railway app (EU region)
- 9+ content generation workflows working (3 LinkedIn, 3 Newsletter, 3 Blog drafts)
- SEO Command Center with sample keyword data (no GSC)
- Content Calendar with manual scheduling
- Knowledge Base upload for APSOparts brand and product documents
- Audit log of every AI generation and approval action
- Basic Google Workspace OAuth login (optional in Phase 1, mandatory in Phase 2)
- This document + `SECURITY-INFRASTRUCTURE.md` signed off by Group Security

### Phase 2 deliverables
- AWS EU deployment (Terraform / CDK repo)
- Google Workspace SSO enforcement
- Real GA4 / GSC / Magento / LinkedIn read integrations
- Production-grade monitoring and alerting
- Penetration test report by an independent third party
- Updated Data Processing Impact Assessment (DPIA)
- GDPR Record of Processing Activities (ROPA) entry

### Phase 3 deliverables
- Quarterly improvement release
- Optional scheduled-publishing integrations (per separate security review)
- Marketing feedback loop dashboard

---

## 7. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI generates off-brand / incorrect technical content | Medium | High | Mandatory human approval gate on every draft; brand tone checker; materials datasheet grounding |
| AI provider outage (Claude or Gemini) | Low | Medium | Dual-provider setup (either model can be selected) |
| Unauthorized access to Phase 1 Railway instance | Low | Medium | OAuth login recommended in Phase 1; IP allowlist optional |
| API key leak from Railway env vars | Very low | High | Keys scoped to content generation only; no financial or PII access; rotation quarterly |
| GDPR non-compliance (Phase 2 data flows) | Medium | High | DPIA completed before Phase 2 go-live; read-only scopes; EU hosting |
| Scope creep into customer data | Medium | High | Written policy: no PII, no orders, no CRM; reviewed by Security at each phase gate |
| Railway agency account compromise | Very low | High | Agency must provide SOC 2 or equivalent; migrate to AWS at Phase 2 |

---

## 8. Exit strategy / reversibility

At any phase, the project can be paused or rolled back with **no data loss and no operational impact on live systems**, because:
- Phase 1: no live system connections exist
- Phase 2: all integrations are read-only, so disabling them does not affect source systems
- Phase 3: write-access is opt-in per integration and individually reversible

The hub is **additive, never destructive** to existing marketing workflows.
