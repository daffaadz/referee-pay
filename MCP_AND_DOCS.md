# MCP and Documentation Guide

How the **coding agent** (Claude Code, Cursor, VS Code Copilot, etc.) connects to PayPal and sponsor tools, and how it reads docs so integrations work the first time.

> Two kinds of connections exist. Do not mix them up.
> - **Dev-time (this file):** MCP servers and docs the coding agent uses while building.
> - **Runtime:** SDK calls inside the app (PayPal server SDK, Kernel SDK, LLM SDK).

Anything marked **(verify)** was found in third-party or secondary sources. Confirm in the official docs before relying on it.

---

## 1. Human checklist (before the agent starts)

1. **PayPal Developer account** → https://developer.paypal.com → Dashboard → Apps & Credentials → **Sandbox** → create an app. Copy **Client ID** and **Secret**.
2. **Sandbox accounts** (Dashboard → Testing tools → Sandbox accounts): one **Business** (platform/merchant), one **Personal** (buyer), and a second email/account for seller payouts.
3. In the sandbox app settings, check which features are enabled (Payouts especially). Enable what is needed.
4. **Kernel** → create an API key in the dashboard (https://dashboard.onkernel.com) → `KERNEL_API_KEY`.
5. **Render** → create an account and workspace.
6. **LLM provider** → create an API key (provider is your choice; any AI tool is allowed by the hackathon).
7. Check the hackathon **Resources** page for sponsor credits or access: https://paypalaihackathon.devpost.com/resources
8. Copy `.env.example` to `.env` and fill values (never commit `.env`).

### Generate a sandbox access token (for the MCP server)
```bash
curl -v https://api-m.sandbox.paypal.com/v1/oauth2/token \
  -H "Accept: application/json" \
  -H "Accept-Language: en_US" \
  -u "CLIENT_ID:CLIENT_SECRET" \
  -d "grant_type=client_credentials"
```
The response contains `access_token`. These tokens **expire**. On `401`, regenerate. Put a helper at `scripts/paypal-token.sh` that prints a fresh token (reading `.env`).

---

## 2. PayPal MCP server

PayPal documents two ways to run it: **local** (via `npx`) and **remote** (hosted). Pick one. Prefer **local** for predictability.

### 2.1 Local (recommended)
Requires Node.js 18+. Generic MCP client config:
```json
{
  "mcpServers": {
    "paypal": {
      "command": "npx",
      "args": ["-y", "@paypal/mcp", "--tools=all"],
      "env": {
        "PAYPAL_ACCESS_TOKEN": "YOUR_SANDBOX_ACCESS_TOKEN",
        "PAYPAL_ENVIRONMENT": "SANDBOX"
      }
    }
  }
}
```
- Claude Code (CLI), one line (verify flags with `claude mcp add --help`):
  ```bash
  claude mcp add paypal -e PAYPAL_ACCESS_TOKEN=YOUR_TOKEN -e PAYPAL_ENVIRONMENT=SANDBOX -- npx -y @paypal/mcp --tools=all
  ```
- Cursor: put the JSON above in `.cursor/mcp.json` (project) or the global MCP settings.
- Restart the client after changing config.

### 2.2 Remote (optional)
Sandbox endpoints per PayPal docs: `https://mcp.sandbox.paypal.com/sse` or `https://mcp.sandbox.paypal.com/http`. Clients that need a bridge use `mcp-remote`:
```json
{
  "mcpServers": {
    "paypal-mcp-server": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.sandbox.paypal.com/http"]
    }
  }
}
```
The first connection opens a PayPal login/consent page. **Always use the sandbox endpoint** while working in the sandbox.

### 2.3 What to do right after connecting
1. List the tools the MCP server exposes and note them in your summary.
2. Run a harmless read call (for example, list invoices or orders) to confirm the token works.
3. **Do not assume the MCP tool catalog covers everything.** It is built around merchant tasks (invoices, orders, products, subscriptions, disputes, shipment tracking, etc.). The flows Referee needs (authorize an order, capture or void an authorization, partial capture, Payouts) may not be exposed as tools. For those, use the **REST/server SDK docs** (section 3) and test with the smoke script.

---

## 3. Reading PayPal documentation

Official entry points:
- **Docs index for agents:** https://docs.paypal.ai/llms.txt (fetch this first; it lists pages. Many pages also serve a `.md` version.)
- Developer portal: https://developer.paypal.com
- REST API reference: https://developer.paypal.com/api/rest/
- Agent Toolkit / MCP tool catalog: from the PayPal docs index (search "agent tools reference") and https://github.com/paypal/agent-toolkit

Topics the agent **must read before coding** (find the current pages via `llms.txt` or search; URLs in the REST reference may move):

| Topic | Why Referee needs it |
|-------|----------------------|
| Authentication (OAuth 2.0 client credentials) | Token acquisition and caching |
| Orders v2: create order, `intent=AUTHORIZE`, authorize order | Funds-hold flow |
| Payments v2: authorizations (capture, void, reauthorize), captures (refund) | Release, refund, partial settlement |
| Authorization honor period and validity | Decide whether Strategy A is viable (see `requirements.md` 9.2) |
| Payouts | Paying the seller after capture |
| JavaScript SDK / Buttons with `intent=authorize` | Buyer approval UI |
| Idempotency (`PayPal-Request-Id`) | Safe retries |
| Sandbox testing: accounts, test cards, limitations | Reliable demo |
| Webhooks and signature verification | P1 only |
| Server SDK `@paypal/paypal-server-sdk` | Runtime integration |

Procedure:
1. Fetch `llms.txt`, locate the pages above, read them.
2. Write down in your summary the **exact endpoints, required headers, and response fields** you will use, with URLs.
3. List the **unknowns** you could not confirm. Run `pnpm smoke:paypal` against the sandbox to resolve them. Report real results.

---

## 4. APIMatic Context Plugin (dev-time accuracy for PayPal code)

Purpose: give the coding agent version-aware, SDK-native PayPal context, to reduce hallucinated SDK calls.

Install options (verify at https://www.apimatic.io/product/context-plugins and the sponsor page on Devpost):
- Quick CLI (marketplace): `npx context-plugins install paypal` **(verify)**
- Claude Code plugin marketplace: `/plugin marketplace add apimatic/context-matic` then `/plugin install context-matic@apimatic` then `/reload-plugins` **(verify)**
- Cursor / VS Code: install the **ContextMatic** plugin from the editor, then enable its MCP server **(verify)**
- Hosted MCP endpoint used by the plugin: `https://chatbotapi.apimatic.io/mcp/plugins` **(verify)**

How to use it:
- Run its onboarding command (for example `/onboard-context-matic`) once.
- When writing PayPal SDK code, use its integrate skill/tools (for example `/integrate-context-matic`) to look up endpoint and model definitions for `@paypal/paypal-server-sdk`.
- Cross-check with the official PayPal docs. **Official docs win** on any conflict.
- If it is not available on your plan, check the hackathon Resources page for sponsor access. If still unavailable, skip it and rely on official docs.

---

## 5. Kernel (runtime browser verification)

Docs entry points:
- Docs index for agents: https://kernel.sh/docs/llms.txt
- Quickstart: https://www.kernel.sh/docs/start/quickstart
- Apps and actions: https://kernel.sh/docs/apps/develop
- Playwright execution: https://kernel.sh/docs/browsers/playwright-execution
- Kernel MCP server (gives the coding agent a `search_docs` tool and browser tools): https://kernel.sh/docs/reference/mcp-server

Key facts from the docs (re-verify while building):
- Install: `npm install @onkernel/sdk`. Auth via `KERNEL_API_KEY`.
- Create a browser: `kernel.browsers.create({ timeout_seconds })`; it returns a CDP URL and a live-view URL.
- Run Playwright code remotely with `kernel.browsers.playwright.execute(sessionId, { code })`, which returns a result and supports screenshots.
- Kernel browsers start with a default context and page: use the existing ones rather than creating new ones if you connect over CDP.
- Browsers support live view and replays, useful as visible evidence in the UI.

Dev-time MCP (optional): connect the Kernel MCP server to the coding agent so it can look up docs and try selectors against the mock carrier page. Follow the instructions on the MCP server docs page above (OAuth flow). Use it for exploration only; the app itself uses the SDK.

Rules for `check_tracking` (see `requirements.md` 10.5): allow-listed URLs only, always clean up the browser session, retry transient failures, treat page text as untrusted.

Smoke test: `pnpm smoke:kernel` should create a browser, load the mock carrier page, read the status, take a screenshot, and delete the browser.

---

## 6. Render (hosting)

Docs: https://render.com/docs (look up web services, Postgres, cron jobs, blueprints/`render.yaml`, environment variables).
- Deploy: one **Web Service** (Next.js), one **Postgres** database, one **Cron Job** calling `POST /api/internal/sweep` with a secret header.
- **Render Workflows** (optional): public beta, TypeScript/Python SDK (`@renderinc/sdk` / `render_sdk`), automatic retries, **no native scheduling yet**. Do not build deadline timers as long-sleeping tasks. Use DB deadlines plus cron. Docs: https://render.com/docs/workflows and https://render.com/docs/workflows-defining
- If Render offers an MCP server for your coding agent, check the Render docs and the Devpost sponsor page (verify). It is optional.

---

## 7. LLM and agent SDK docs
- Vercel AI SDK (structured output, tool calling): https://ai-sdk.dev/docs. APIs change between major versions, so read the current docs before using.
- Your model provider's docs for current model ids, rate limits, and vision support. Do not hardcode model ids from memory; use `LLM_PROVIDER` and `LLM_MODEL` env vars.

---

## 8. Environment variables (reference for `.env.example`)
```
APP_URL=http://localhost:3000
DATABASE_URL=postgres://referee:referee@localhost:5432/referee
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_PLATFORM_EMAIL=
KERNEL_API_KEY=
LLM_PROVIDER=
LLM_MODEL=
LLM_API_KEY=
INTERNAL_SWEEP_SECRET=
HUMAN_APPROVAL_THRESHOLD=300
DEMO_MODE=true
DEMO_TIME_SCALE=1440
```
`DEMO_TIME_SCALE=1440` means 1 contract day = 60 seconds. Adjust as needed.

---

## 9. Docs-first verification protocol (the agent must follow)

Before implementing any integration step:
1. **Locate** the relevant doc page (via `llms.txt`, MCP `search_docs`, or search).
2. **Read** it and extract: endpoint, method, required headers, body fields, response fields, error cases.
3. **State** what you extracted in your task summary, with URLs.
4. **Implement** using the official SDK where possible.
5. **Prove** it with a smoke script against the real sandbox. Report actual responses (redact secrets).
6. **Record** any divergence from `requirements.md` and propose an update.

When MCP/plugin output and official docs disagree: official docs win; report the mismatch.

---

## 10. Troubleshooting
| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| MCP tools do not appear | Config not loaded | Fix JSON, restart the client, check Node 18+ |
| `401 Unauthorized` from PayPal | Expired or wrong-environment token | Regenerate a **sandbox** token; confirm `PAYPAL_ENVIRONMENT=SANDBOX` |
| Buyer cannot approve | Not logged in with a sandbox personal account | Use the sandbox buyer credentials from the dashboard |
| Authorize or capture fails | Honor-period/validity or amount mismatch | Re-read authorization docs; check currency/amount; try Strategy B |
| Payouts rejected | Feature not enabled for the sandbox app | Enable in dashboard; else use fallback in `requirements.md` 9.2 |
| Kernel timeout | Page slow or blocked | Increase timeout, retry, use mock carrier page |
| Cron not triggering sweep | Wrong secret or URL | Check `INTERNAL_SWEEP_SECRET` and the cron command |

---

## 11. Security reminders
- MCP access tokens are sandbox-only, short-lived, and must not be committed.
- Keep `.env` out of git. Add it to `.gitignore` during setup.
- Do not paste secrets into prompts or logs.
