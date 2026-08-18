# AWS / True Soft Meeting Prep — APSO Marketing Hub on Fargate

> **Meeting:** Monday after 13:00 with Radoslaw + a **True Soft** solution
> architect (the partner who will implement the app in AWS).
> **Your two goals:** (1) be 100% fluent technically, (2) walk out with a
> concrete path to **deploy the app yourself**.
> **Companion doc:** the slide deck `APSOMarketingHub _Review AWS Document.pptx`
> (Downloads) — this file is the spoken-language version of it, plus the
> answers to the open questions you raised.

---

## 0. TL;DR — read this if you read nothing else

1. **"Sketch" = an architecture diagram, NOT a finished app.** They want the
   boxes-and-arrows picture of how the app sits in AWS, plus the list of what
   the container needs. You already have that diagram (slide 7 of the pptx).
   The app itself is already built and running on Railway — porting it to AWS
   is a **redeploy, not a rewrite**. Section 2.
2. **Ports:** your app listens on **one HTTP port (3000)** inbound; it calls
   out to **Claude and Gemini over HTTPS (443)**. "Port 903" is almost
   certainly either a mis-transcription of **443** or a corporate
   **egress-proxy** port — confirm on the call. Section 4.
3. **Claude API** = a normal outbound HTTPS call to `api.anthropic.com:443`
   with an API key kept in Secrets Manager. Nothing special to install.
   Section 5.
4. **You're missing a `Dockerfile`** — Railway builds with Nixpacks, but
   Fargate needs a real container image. This is the #1 concrete prep item.
   Section 6.
5. **To deploy yourself**, ask for the **GitHub Actions → ECR/ECS pipeline**
   (push code → it deploys) plus a **scoped IAM role**. Section 8.

---

## 1. What Fargate actually is (so you can talk about it confidently)

- **ECS** = AWS's container orchestrator. **Fargate** = the "serverless" way to
  run those containers: **you give AWS a container image, AWS runs it — you
  never touch a server, an OS, patching, or scaling machines.**
- Mental model vs Railway: Railway already hides the server from you. Fargate
  is the **enterprise-grade equivalent** — same idea (push image, it runs),
  but inside the company's AWS account, VPC, and security controls.
- Key vocabulary you'll hear:
  - **Task** = one running copy of your container (think: one instance of the app).
  - **Service** = the manager that keeps N tasks alive and replaces dead ones.
  - **Task definition** = the recipe: image, CPU, RAM, port, env vars/secrets.
  - **ALB (Application Load Balancer)** = the public front door; terminates
    HTTPS and forwards traffic to your tasks.
  - **VPC** = the private network the tasks live in.
  - **ECR** = AWS's private Docker registry where your image is stored.
  - **Fargate sizing** = you pick vCPU + RAM (e.g. 0.5 vCPU / 1 GB) and pay
    per second it runs.
- **Why Fargate over a bare EC2 VM** (the deck's recommendation, in your words):
  "An EC2 VM is easy to launch but then *I* own the OS — patching, reboots,
  scaling, HA, TLS. With Fargate AWS owns all of that; patching is just
  rebuilding the image. Same outcome, far less operational risk." App Runner
  is the simpler fallback (closest to Railway) but gives less network control.

---

## 2. The "sketch" question — exactly what they're asking for

Radoslaw asked *"do you have a sketch of how the application would look on AWS?"*
In cloud-architecture language a **"sketch" = a target-state architecture
diagram** + the requirements list the implementer needs. It is **not** a
request for a ready-to-deploy app.

**What True Soft actually needs from you (you already have most of it):**

```
                         ┌─────────────────────────────────────────┐
   User browser ──HTTPS──▶│  Route 53 (DNS)                         │
   (TLS 1.3)              │     │                                   │
                          │     ▼                                   │
                          │  AWS WAF  (OWASP rules + rate limit)     │
                          │     │                                   │
                          │     ▼                                   │
                          │  Application Load Balancer (HTTPS:443)   │
                          │     │  forwards to container port 3000   │
                          │     ▼                                   │
                          │  ECS Fargate task — Next.js 15 container │
                          │     │            │            │         │
                          │     ▼            ▼            ▼         │
                          │  RDS Postgres  Secrets Mgr  CloudWatch   │
                          │  (users+audit) (+KMS keys)  (logs 24mo)  │
                          └─────────────────────────────────────────┘
   Outbound (server-side only, all egress logged), HTTPS:443 →
     • api.anthropic.com        (Claude — content generation)
     • generativelanguage.googleapis.com (Gemini — A/B + images)
   Phase 2 read-only adds: GA4, Search Console, Magento REST, LinkedIn, HubSpot
```

That diagram **is** the sketch. So when they ask "do you have the sketch?" the
answer is **yes** — it's slide 7 of the deck, and this is the spoken version.
What you *don't* need to bring is a deployed app; what you *do* bring is the
**container contract** (Section 3) so they can build the landing zone.

> If anyone means "is the app finished?" — yes: it runs in production on
> Railway today (Phase 1). AWS is about *where it's hosted and how it's
> secured*, not whether it works.

---

## 3. The "container contract" — the answers they will ask you for

Have these ready; this is what an architect needs to write the task definition:

| Question they'll ask          | Your answer                                                        |
| ----------------------------- | ------------------------------------------------------------------ |
| What runtime?                 | Node.js 20 LTS, Next.js 15 (App Router) + React 19                  |
| How is it built?              | Today: Nixpacks (Railway). For ECS: a **Dockerfile** → ECR (Sec 6) |
| What port does it listen on?  | **HTTP 3000** (configurable via `PORT` env var)                    |
| Is it stateless?              | **Yes** — all state is in Postgres; tasks can be killed/replaced   |
| Database?                     | **PostgreSQL 17+** (latest RDS-supported) → **RDS** `db.t4g.micro`; auto minor upgrades |
| Health check path for the ALB | Add **`/api/health`** returning 200 (Sec 6) — don't rely on `/`    |
| CPU / RAM?                    | Start at **0.5 vCPU / 1 GB**; one task is fine, two for HA         |
| Secrets needed                | `AUTH_SECRET`, `AUTH_MASTER_PASSWORD`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `DATABASE_URL` → **Secrets Manager**, injected as env vars |
| Outbound endpoints to allow   | `api.anthropic.com:443`, `generativelanguage.googleapis.com:443`, DNS:53 |
| Region                        | **eu-central-1 (Frankfurt)** — EU data residency                   |
| Domain / TLS                  | `apsomarketinghub.com` (prod apex) + `dev.apsomarketinghub.com` (test). Registered at **Hostinger** → delegate nameservers to **Route 53** (keep registration, no transfer). Apex **alias** → ALB. ACM cert `apsomarketinghub.com` + `*.apsomarketinghub.com`; ALB terminates TLS |
| Scaling                       | Target-tracking on CPU; min 1–2 tasks, max small (low traffic app) |

---

## 4. Ports — the full matrix (this is what "port 903" is really about)

An architect asks about ports to write the **security-group rules**. Two
directions:

**Inbound (into your container):** exactly **one** port.
- The app runs `next start -p ${PORT:-3000}` → it binds **HTTP on 3000**.
- The ALB listens on **443 (public HTTPS)**, terminates TLS, and forwards to
  **container:3000** inside the VPC. So: public 443 → internal 3000. Nothing
  else is open.

**Outbound (from your container):** HTTPS only.
- **Claude:** `api.anthropic.com` on **TCP 443**.
- **Gemini:** `generativelanguage.googleapis.com` on **TCP 443**.
- DNS on 53, RDS Postgres on **5432** (inside the VPC only), Secrets Manager on 443.

**About "port 903":** there is no standard Claude/Anthropic port 903 — Claude
is plain HTTPS on **443**. The most likely explanations, in order:
1. It was **"443" mis-heard/transcribed** as "903" on the call.
2. The corporate network forces all outbound through an **egress proxy on a
   fixed port** (some orgs use a non-standard proxy port); the architect may
   want your app to honor `HTTPS_PROXY` pointing at that port.
3. A specific internal service endpoint True Soft maintains.

**→ Ask directly on the call:** *"When you said port 903 — do you mean the
outbound port my app uses to reach Claude (that's 443 HTTPS), or a corporate
egress-proxy port I need to route through? And which port do you want the
container to expose to the ALB — I default to 3000."* That one question
resolves it cleanly and shows you understand the networking.

---

## 5. The Claude (Anthropic) API — what it is in this context

- It is a **REST API over HTTPS**. The app already calls it via the official
  `@anthropic-ai/sdk` (see `package.json`). No agent, daemon, or open port to
  install — just outbound 443 to `api.anthropic.com`.
- **Auth** = a single API key (`ANTHROPIC_API_KEY`), kept **server-side only**
  in Secrets Manager, never exposed to the browser (CSP + the deck's principle
  #4 "no `NEXT_PUBLIC_` on secrets").
- **Data:** prompts contain **only public marketing content** in Phase 1 — no
  PII, no customer/CRM data. Anthropic's API has **zero data retention** for
  API traffic and the contract includes **GDPR SCCs** (deck slide 13).
- If True Soft proposes **AWS Bedrock** (Claude served from inside AWS) instead
  of the public Anthropic API: that's a legitimate option (keeps the call
  inside AWS, no public egress), but it's a code/SDK change and a separate
  decision — note it as a "nice future option," not a blocker for Phase 2.

---

## 6. The concrete gaps to close before you can deploy (do these this week)

These are real, in-the-code items. Fixing them = you're genuinely deploy-ready.

### 6.1 Add a production `Dockerfile` (Fargate needs an image)
Railway uses Nixpacks; ECS needs an image in ECR. Recommended multi-stage
build using Next.js **standalone** output:

First, enable standalone in `next.config.ts`:
```ts
const nextConfig: NextConfig = {
  output: "standalone",      // ← produces a lean, self-contained server bundle
  async headers() { /* ...existing security headers... */ },
};
```

Then `Dockerfile` at the repo root:
```dockerfile
# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- run ----
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```
And a `.dockerignore` (`node_modules`, `.next`, `.git`, `.env*`).

### 6.2 Add a real health endpoint for the ALB
`/` redirects to login (302), which is a fragile health signal. Add
`src/app/api/health/route.ts`:
```ts
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ status: "ok" }, { status: 200 });
}
```
Point the ALB target-group health check at **`/api/health`** (expect 200).

### 6.3 Confirm secrets list
Five secrets go into Secrets Manager (see table in Sec 3). Make sure none are
ever committed (deck Phase-1 gate: ".gitignore verified, no real secrets in
git").

> Want me to actually create the `Dockerfile`, `.dockerignore`, the
> `output: "standalone"` change, and the `/api/health` route now? Say the word
> and I'll add them so you walk in with the repo already container-ready.

---

## 7. Cost — so you're not surprised when they mention it

Phase 1 on Railway is ~CHF 36–72/month. A small HA-capable Fargate setup is
realistically **~CHF 80–150/month**, broken down roughly:
- Fargate task (0.5 vCPU / 1 GB, 24/7): **~$18/mo** per task.
- ALB: **~$16–22/mo**.
- RDS `db.t4g.micro`: **~$12–15/mo**.
- **NAT Gateway: ~$32/mo + data** ← the usual surprise cost. Mitigation: use
  **VPC endpoints** for AWS services and/or a single NAT, or a public-subnet
  task with tight egress rules. Worth asking True Soft how they handle egress.
- Secrets Manager (~$0.40/secret), CloudWatch logs: a few dollars.

This is a low-traffic internal app, so cost is small — but **name the NAT
gateway** so you look like you've costed it properly.

---

## 8. Getting the right to deploy yourself — what to ask for

You want to be able to ship updates without going through True Soft each time.
Two models — **ask for Model A, accept B as fallback:**

### Model A (recommended) — GitOps / CI-CD self-service
"Deploying" becomes **merging to `main`** in GitHub. The deck already plans
this (GitHub Actions → ECR + ECS). You need:
- A **GitHub Actions pipeline** that: builds the image → pushes to **ECR** →
  runs `aws ecs update-service --force-new-deployment`.
- An **IAM role assumed via GitHub OIDC** (no long-lived AWS keys in GitHub).
- **Repo write access** for you (you already own the code).
- **Read access** to CloudWatch logs + the ECS console to watch the rollout.

→ This is the cleanest, most security-friendly ask: you never hold AWS admin,
you just merge code, and the company keeps full audit + rollback.

### Model B (fallback) — direct scoped CLI/console access
If they want a human to push manually, ask for an **IAM user/role (federated
through Entra ID SSO)** scoped to *only this app's resources*. Sample policy to
request (they will tighten the ARNs):
```jsonc
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "PushImage", "Effect": "Allow",
      "Action": ["ecr:GetAuthorizationToken","ecr:BatchCheckLayerAvailability",
                 "ecr:InitiateLayerUpload","ecr:UploadLayerPart",
                 "ecr:CompleteLayerUpload","ecr:PutImage","ecr:BatchGetImage"],
      "Resource": "arn:aws:ecr:eu-central-1:<acct>:repository/apso-marketing-hub" },
    { "Sid": "DeployService", "Effect": "Allow",
      "Action": ["ecs:UpdateService","ecs:DescribeServices","ecs:DescribeTasks",
                 "ecs:RegisterTaskDefinition","ecs:ListTasks"],
      "Resource": "*" },
    { "Sid": "PassExecRole", "Effect": "Allow", "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::<acct>:role/apso-mh-task-exec-role" },
    { "Sid": "Logs", "Effect": "Allow",
      "Action": ["logs:GetLogEvents","logs:FilterLogEvents","logs:DescribeLogStreams"],
      "Resource": "*" }
  ]
}
```

### What you'll need to KNOW to deploy (write these down on the call):
- AWS **account ID** + **region** (eu-central-1).
- **ECR repository** name/URI.
- **ECS cluster** + **service** name.
- **Task execution role** ARN (for `iam:PassRole`).
- How **secrets** are updated (you'll need to set/rotate the 4 API keys).
- Whether MFA / SSO is required to assume the role (it will be — via Entra ID).

> **Important framing for the room:** self-deploy rights almost certainly need
> **Group IT / Group Security sign-off**, not just True Soft's OK. The deck
> already says you're "blocked on Group IT for AWS onboarding + Entra app
> registration." So phrase it as: *"I'd like the CI-CD pipeline set up so I can
> deploy by merging to main, with a scoped OIDC role — who in Group IT owns
> granting that?"* That moves it forward without overreaching.

---

## 9. Open items you are (legitimately) blocked on — name them

From the deck's Phase-2 gate; mention you know these are prerequisites:
- AWS account + VPC + IAM + Secrets Manager defined **as code** (Terraform/CDK) — True Soft's job.
- **Entra ID** app registration (SSO replaces the current password+TOTP login) — Group IT.
- **Conditional Access MFA** alignment — Group IT.
- **DPIA** + **ROPA** entry, pen-test with no critical/high findings — Group Security.
- Read-only API credentials (GA4/GSC/Magento/LinkedIn/HubSpot) provisioned by Group IT — **Phase 2, not needed to host the app**.

---

## 10. Questions to ask True Soft (your checklist for the call)

1. Confirm **"port 903"** — outbound to Claude (443) or a corporate egress proxy? What container port do you want exposed (I default to 3000)?
2. Fargate or App Runner — which do you recommend for a low-traffic internal app, and why?
3. How do you handle **egress** (NAT gateway vs VPC endpoints) and at what cost?
4. Do you want the image **built by GitHub Actions → ECR**, or do you build it? (I'm adding a Dockerfile either way.)
5. Can we set up the **CI-CD pipeline + OIDC role so I can self-deploy** by merging to main? Who in Group IT approves that?
6. Is **Bedrock** (Claude inside AWS) on the table, or do we keep the public Anthropic API with egress allow-listing?
7. Who owns the **Entra ID app registration**, and what's the timeline?
8. What's your expected **timeline** to a working dev environment in eu-central-1?

---

## 11. One-paragraph script you can open the meeting with

> "The app is already live in production on Railway as an isolated Phase-1
> sandbox — no corporate data, only public marketing content, and just two
> outbound calls, to Claude and Gemini over HTTPS. Moving to AWS is a redeploy,
> not a rewrite: same Next.js container, behind an ALB and WAF, in a Frankfurt
> VPC, secrets in Secrets Manager. I've got the architecture sketch ready
> [slide 7]. What I'd like from today is to agree the Fargate shape, sort out
> egress and the Claude endpoint, and set up a CI-CD pipeline so I can deploy
> updates myself by merging to main, with a properly scoped role. I'm adding a
> Dockerfile and a health endpoint this week so the repo is container-ready."
