# Referee — Neutral AI Escrow & Arbiter

> A neutral, explainable AI arbiter that holds a buyer's money through PayPal (sandbox) until a deal is fulfilled, verifies delivery by browsing the real web (Kernel), and autonomously decides: **release, refund, or settle**.

Built for the **PayPal AI Hackathon 2026**.

---

## 1. What It Is

Strangers transact every day across Instagram, WhatsApp, Facebook Marketplace, and freelance chats. Trust is the bottleneck:
- Buyers fear paying upfront and receiving nothing or damaged goods.
- Sellers fear shipping goods and getting hit with fraudulent chargebacks.

**Referee** solves this with a proactive, explainable escrow layer:
1. **Plain Language Contract:** Seller and buyer agree on terms; the Drafter agent generates an immutable Deal Contract with explicit clauses and deadlines.
2. **Funds Held Safely:** Buyer funds the transaction via PayPal using `intent=AUTHORIZE`. Money is held, not released.
3. **Real-Web Delivery Verification:** Seller submits tracking; Referee launches an isolated cloud browser (Kernel), navigates the carrier page, extracts proof, and attaches screenshot evidence.
4. **Autonomous Arbiter:** When delivery and terms agree, Referee releases payment. If the seller never ships, it voids/refunds. If issues arise, it negotiates settlements or escalates.
5. **Explainable Decision Log:** "LLM proposes, policy disposes." Every money movement is evaluated by a deterministic Policy Engine and cites specific contract clauses and verified evidence items.

---

## 2. Prerequisites

- **Node.js**: `v20+` (tested on Node v22 / v24)
- **pnpm**: `v10+` or `v11+`
- **Docker** & **Docker Compose** (for local PostgreSQL)
- **PayPal Developer Account**: Sandbox REST App credentials (Client ID and Secret)
- **Kernel Account**: API key for cloud browser automation
- **LLM API Key**: Gemini API key (or provider of choice)

---

## 3. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your sandbox credentials:
```env
APP_URL=http://localhost:3000
DATABASE_URL=postgres://referee:referee@localhost:5432/referee

# PayPal Sandbox Credentials
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
PAYPAL_PLATFORM_EMAIL=platform-merchant@business.example.com

# Kernel Cloud Browser
KERNEL_API_KEY=sk_kernel_...

# AI Model Provider
LLM_PROVIDER=google
LLM_MODEL=gemini-2.5-flash
GEMINI_API_KEY=AIzaSy...

# Internal Sweeper & Settings
INTERNAL_SWEEP_SECRET=your_random_sweep_secret
HUMAN_APPROVAL_THRESHOLD=300
DEMO_MODE=true
DEMO_TIME_SCALE=1440
```

> **Note:** The application strictly enforces `PAYPAL_ENV=sandbox` and will refuse to boot in any other mode.

---

## 4. Quickstart

### 1. Start Local Postgres
```bash
docker compose up -d
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Push Database Schema
```bash
pnpm db:push
```

### 4. Run Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Verification & Testing

- `pnpm typecheck` — Static TypeScript verification
- `pnpm lint` — Code quality checks
- `pnpm test` — Run unit and policy engine tests
- `pnpm eval` — Run 8/8 golden referee scenarios
- `pnpm smoke:paypal` — Sandbox OAuth, authorize, capture, and void verification
- `pnpm smoke:kernel` — Real cloud browser automation test

---

## 6. Limitations & Disclosures

- **Sandbox Only:** This application is configured strictly for the PayPal Sandbox environment. No real funds or financial transactions occur.
- **Prototype Escrow:** Holding third-party funds is a regulated activity subject to escrow and money-transmission laws varying by jurisdiction. Referee is a hackathon prototype showcasing autonomous agent decisioning and PayPal developer primitives, not a licensed financial institution.
- **Mock Carrier for Demos:** To ensure dependable demonstrations and adhere to contest video guidelines against unauthorized third-party trademark display, carrier verification is tested against controlled mock tracking pages and generic carrier layouts.

---

## 7. License

Distributed under the [MIT License](LICENSE).

