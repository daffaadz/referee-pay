# Referee: Neutral AI Escrow & Arbiter
### PayPal AI Hackathon 2026 Submission

> **Live Application:** [https://referee-pay.vercel.app](https://referee-pay.vercel.app)  
> **Source Repository:** [https://github.com/daffaadz/referee-pay](https://github.com/daffaadz/referee-pay)  
> **API Docs Portal:** [https://referee-pay.vercel.app/docs/api](https://referee-pay.vercel.app/docs/api) (or `docs/api/index.html`)

---

## 1. Executive Summary

Strangers transact every day across Instagram, WhatsApp, Discord, and freelance marketplaces. The core dilemma: **buyers fear paying upfront and receiving nothing, while sellers fear shipping goods and getting hit with dishonest claims**. Traditional escrow services are slow, expensive, and manual; PayPal dispute resolution only begins *after* a transaction fails.

**Referee** is an autonomous, explainable AI arbiter that holds a buyer's money through PayPal sandbox until terms are fulfilled, verifies physical delivery by browsing the live web with **Kernel**, and autonomously decides to **release, refund, or escalate** under strict, deterministic policy guardrails.

---

## 2. Sponsor Tools and Technologies Used

| Tool / Sponsor | Role & Implementation Details |
|---|---|
| **PayPal Sandbox** (Core Financial Engine) | Implements delayed capture escrow using `@paypal/paypal-server-sdk`. Orders are created with `intent=AUTHORIZE`. Funds are captured upon verified delivery with `finalCapture: true` and routed to the seller's verified PayPal email via Payouts v1. Refunds are executed by voiding authorizations. Every financial operation uses strict idempotency keys (`PayPal-Request-Id`) derived from `dealId + action`. |
| **Kernel** (Real-Web Verification) | Automated cloud browser execution using `@onkernel/sdk`. Launches disposable browser sessions to inspect live carrier tracking pages, extracts DOM milestones, and captures tamper-proof visual screenshot artifacts stored directly in the deal audit trail. |
| **Google Gemini & Vercel AI SDK** (AI Drafter & Arbiter) | `gemini-3.5-flash-lite` powers two distinct agent roles: the **Drafter Agent** (transforms plain English deal terms into structured contracts with numbered clauses `C1` to `C5`) and the **Referee Arbiter** (evaluates fulfillment evidence and proposes verdicts with cited clauses). "LLM proposes, Policy Engine disposes." |
| **AG Studio / AG Grid** (Seller Command Center) | The `/dashboard` command center is built on AG Studio and AG Grid, featuring four core widgets: KPI Row (funds held, 30-day releases, refund rate), Pipeline Chart, Deals at Risk grid, and Verified PayPal Ledger with CSV export. Includes custom telemetry widgets and the P1 **Referee Analyst Agent** for interactive data exploration. |
| **Bryntum** (Fulfillment Board & Gantt) | Bryntum Scheduler (`@bryntum/scheduler-trial`) renders an interactive timeline of ship, delivery, and inspection windows with Referee decision markers that update and highlight in real time upon arbiter events. In the Deal Room, Bryntum Gantt (`@bryntum/gantt-trial`) visualizes the contract cascade (Pay, Ship, Verify, Review, Release) comparing planned baselines against actual execution. |
| **APIMatic** (Dev-Time Context & OpenAPI 3.1 Spec) | Used during development to validate `@paypal/paypal-server-sdk` methods, schemas, and error shapes against official docs (documented in `docs/APIMATIC_USAGE.md`). Authored the official OpenAPI 3.1 contract (`openapi/referee.yaml`), static documentation portal (`docs/api/index.html`), and generated TypeScript SDK (`sdk/`). |
| **Vercel & Neon** (Production Hosting) | Full-stack Next.js 16 App Router hosted on Vercel Hobby with zero cold-start delay. Database backed by Neon serverless PostgreSQL using pooled connection strings and Drizzle ORM. |

---

## 3. Judge Walkthrough & Demo Instructions

### Option A: Instant Demo Access (No Sandbox Credentials Required)
Judges can evaluate the full seller command center immediately:
1. Visit [https://referee-pay.vercel.app](https://referee-pay.vercel.app).
2. If prompted, visit [https://referee-pay.vercel.app/api/auth/demo](https://referee-pay.vercel.app/api/auth/demo) to instantly authenticate as the seeded **Demo Seller**.
3. You will be redirected to the **Seller Command Center** (`/dashboard`) populated with realistic seeded escrow telemetry, risk detection alerts, and verified PayPal transactions.
4. Switch to the **Fulfillment** tab to view the live Bryntum Scheduler timeline.
5. Click **AI Analyst** to interact with the Referee Analyst agent (try asking *"Which deals are most likely to be refunded?"*).

### Option B: Real PayPal Sandbox Flow (Complete Lifecycle)
To experience the end-to-end escrow lifecycle with real PayPal sandbox accounts:
1. **Seller Login:** Click **Continue with PayPal** on the home page and sign in with any PayPal Sandbox Business or Personal account. The seller's verified PayPal email is automatically captured as the immutable payout destination.
2. **Draft Deal:** Click **New Deal**. Type in natural language:
   > *"Selling vintage Nikon FM2 camera to Alex for $180. Shipping within 3 days with a 5-day inspection window."*
   Click **Draft with AI**. Gemini structures clauses `C1` through `C5`. Click **Create Deal Contract**.
3. **Buyer Approves Hold:** Open the generated Buyer Link in an incognito window. Click **Authorize on PayPal**. Log in with a Sandbox Personal Buyer account. Funds are placed into `FUNDS_HELD` escrow status.
4. **Seller Ships:** On the Seller link, submit carrier tracking number `MCK-123456`.
5. **Kernel Verification:** Referee initiates cloud browser verification via Kernel. The tracking card updates with a verified screenshot and carrier milestone.
6. **Escrow Release:** The buyer clicks **Confirm Delivery** in the Deal Room. Referee evaluates policy, the deterministic Policy Engine approves (`ALLOWED`), and PayPal executes the capture and payout.
7. **Inspect Audit Log:** Click the **Decisions** tab in the Deal Room to review the transparent decision card citing exact contract clauses and verified evidence.

---

## 4. Limitations & Disclosures

- **Sandbox Only:** Referee is strictly configured for the PayPal Sandbox environment (`PAYPAL_ENV=sandbox`). The server asserts this invariant on boot and refuses to connect to live financial networks.
- **Trial Licenses:** Bryntum and AG Studio components run under official 45-day evaluation licenses (`-trial` npm packages). License keys are loaded via environment variables and no proprietary source code has been committed to the repository.
- **Mock Carrier for Video Compliance:** In accordance with hackathon video guidelines regarding third-party trademarks and copyrighted logos, carrier tracking demonstrations utilize the clean mock carrier portal "Referee Parcel Express". The underlying Kernel cloud browser automation is genuine, headless, and carrier-agnostic.
- **Deadline Sweeper Execution:** Vercel Hobby native cron jobs execute once daily; for the hackathon demo, automated 5-minute sweeps are driven via GitHub Actions (`.github/workflows/sweep.yml`) and can also be triggered via the in-app sweep controls.

