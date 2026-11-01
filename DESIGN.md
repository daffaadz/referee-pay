# DESIGN.md: Referee UI system

Single source of truth for the redesign. Light theme only. Tokens are named by role. No raw hex in components.

## 1. Principles
1. One screen, one job. The user always knows what to do next.
2. Calm and warm, not techy. Pine green is the brand, saffron marks the money.
3. Plain words. No payment jargon (authorize, capture, void) in the UI.
4. No default browser controls anywhere. Every control is custom and keyboard accessible.

## 2. Brand assets (already designed, do not redraw)
Files in `/brand`: `referee-logo.svg` (horizontal), `referee-logo-reversed.svg` (for pine or dark surfaces), `referee-symbol.svg`, `referee-icon.svg` (app icon tile), `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon.ico`, `favicon-32.png`.
- Idea: an R whose leg is saffron. The bowl holds, the leg is released.
- Copy to `public/brand/`. Header uses `referee-logo.svg` at height 28px (mobile 24px). Clear space around the logo: at least 8px.
- Favicon via Next metadata `icons` (svg + ico + apple touch). Set `themeColor` to `#0F5C4D`.
- Never recolor, stretch, add effects, or place the colored logo on pine (use the reversed file).

## 3. Color tokens
Primary ("Pine") is `#0F5C4D`. Accent ("Saffron") is only for money and the logo.
```
:root {
  color-scheme: light;
  /* primary ramp */
  --primary-50:#EBFBF4; --primary-100:#D8F5E8; --primary-200:#BBE6D5; --primary-300:#9AD2BE;
  --primary-400:#6EB59F; --primary-500:#489782; --primary-600:#2C7866; --primary-700:#0F5C4D;
  --primary-800:#0A483D; --primary-900:#04332C; --primary-950:#00201B;
  /* tinted neutrals */
  --neutral-0:#FFFFFF; --neutral-50:#F6FBFA; --neutral-100:#EFF6F3; --neutral-200:#E2EAE7;
  --neutral-300:#D0D8D5; --neutral-400:#A5ADAA; --neutral-500:#7A827F; --neutral-600:#57605D;
  --neutral-700:#3C4542; --neutral-800:#262D2B; --neutral-900:#151B19; --neutral-950:#090F0D;
  /* accent */
  --saffron-300:#FFD988; --saffron-400:#F2A81D; --saffron-700:#8A5619;
  /* semantic */
  --success-50:#ECF9EE; --success-100:#D9F3DD; --success-600:#047E39; --success-700:#00672D;
  --warning-50:#FEF4DF; --warning-100:#FEE5B3; --warning-600:#875814; --warning-700:#71440C;
  --danger-50:#FFF2F0;  --danger-100:#FFE4E1;  --danger-600:#AF3C3A;  --danger-700:#932B2A;
  --info-50:#EDF7FE;    --info-100:#DAEEFE;    --info-600:#2B6991;    --info-700:#195579;
}
```
Role tokens (use these in components):
| Role | Token |
|---|---|
| Page background | `--bg` = neutral-50 |
| Card surface | `--surface` = neutral-0 |
| Sunken area (inputs group, code) | `--surface-sunken` = neutral-100 |
| Decorative border (cards, dividers) | `--border` = neutral-200 |
| Control border (inputs, checkbox) | `--border-control` = neutral-500 (3:1+ required) |
| Text / muted text | `--text` = neutral-900 / `--text-muted` = neutral-600 |
| Primary action | `--action` = primary-700, hover primary-800, subtle fill primary-50 |
| Focus ring | primary-500, 2px, offset 2px |
| Money marker | saffron-400 fill with primary-950 text |
Rules: only one filled primary button per viewport. About 90% of the UI is neutral. No gradients, glows, or colored left borders. No blue, cyan, or neon anywhere.
Status chips: Waiting = neutral, Held = saffron-300 bg + primary-950 text, Shipped = info, Delivered and Released = success, Refunded = info, Needs review = warning, Problem = danger. Always icon + text, never color alone.

## 4. Typography
- Headings: **Young Serif** (single weight) for h1, h2 and large money amounts only.
- UI and body: **Hanken Grotesk** (400, 500, 600). `font-variant-numeric: tabular-nums` on every number and amount.
- Load with `next/font/google` (self-hosted, `display: swap`, only used weights/subsets). Verify both families in the current docs.
- Scale (px / line-height): 12/16 caption, 14/20 small and labels, 16/24 body, 20/28 h3, 28/34 h2, 36/42 h1 (desktop), 30/36 h1 (mobile). Letter spacing: -0.01em on h1/h2, normal elsewhere.
- Labels are 14px weight 500, sentence case. Never uppercase section titles.

## 5. Spacing, radius, elevation, motion
- Spacing scale (4px base): 4, 8, 12, 16, 24, 32, 48, 64. Nothing off-scale.
- Card padding 24 (mobile 16). Gap between cards 16. Gap between fields 16. Gap between a label and its control 8. Gap inside a group is always smaller than the gap between groups.
- Radius: `--radius-sm` 8 (inputs, buttons, stepper), `--radius-md` 12 (menus, inner panels), `--radius-lg` 16 (cards), `--radius-full` (chips, avatars). Checkbox 6, radio full.
- Border 1px everywhere. Control height 44px (all inputs, buttons, steppers).
- Shadow: cards `0 1px 2px rgb(21 27 25 / .06)`, menus `0 8px 24px rgb(21 27 25 / .12)`. Nothing else.
- Motion: 120 to 160ms ease-out for hover, press, and menu open. Respect `prefers-reduced-motion`.

## 5b. Layout (key requirement: little scrolling on tablet and laptop)
Breakpoints: mobile < 768, tablet 768 to 1023, laptop >= 1024, wide >= 1280. Max content width 1200, side padding 16 / 24 / 32.
- **Mobile (< 768):** single column. Order: Describe, Terms, Summary. Sticky bottom bar with the price and the Create button.
- **Tablet and laptop (>= 768): two panes in one viewport (app shell).** Page height = 100dvh. Header 64px, compact footer 40px (or none). Panes scroll independently only when content is taller than the screen, using the custom scrollbar. Primary actions are never below the fold.
  - Left pane (5/12, sticky): step 1 card "Describe your deal" (textarea, examples, draft button) and a compact "How it works" card (4 steps).
  - Right pane (7/12): step 2 card "Review the terms" with the three field groups inside. At >= 1024 fields use a 2-column grid (steppers in 3 columns). At 768 to 1023 fields use 1 column. The card has a sticky footer inside it: live summary sentence on the left, Create deal button on the right.
  - After creation the right card becomes the success state (step 3: two link rows with Copy buttons and an Open deal room button). No page change.
- Same shell for Deal Room and Referee decisions: left pane = status, timeline, role actions; right pane = tabs "Evidence" and "Decisions".
- Target: Create Deal fits 1440x900 and 1280x720 without page scroll; at 1024x768 only the right card body may scroll.

## 6. Components (all custom, built on accessible primitives)
Use Radix UI primitives (unstyled) for Select, Checkbox, RadioGroup, Tooltip so keyboard and screen-reader behavior is correct. Style them with the tokens. Justify the dependency in the summary.
- **Button:** primary (filled pine, white text), secondary (white, 1px control border), ghost. 44px, radius-sm, icon 20px, 8px gap. Loading shows a spinner and keeps width. Disabled at 50% with `cursor: not-allowed`.
- **Text input / textarea:** white, 1px control border, radius-sm, 12px horizontal padding. Hover border neutral-700. Focus = focus ring. Error = danger-600 border + message below with an icon. Textarea: `resize: none`, auto-grow (min 2, max 6 rows). Placeholder neutral-500.
- **Number stepper (replaces native number spinner):** `[minus] [value + unit suffix] [plus]` in one 44px group. Minus and plus are 44x44 icon buttons (Phosphor Minus, Plus). Hide native spinners (`appearance: textfield`, `::-webkit-inner-spin-button` none). Support ArrowUp/ArrowDown, hold-to-repeat, min/max/step, `inputMode="numeric"`, disabled at bounds, `aria-label`.
- **Money field:** currency code prefix, tabular numbers, 2 decimals on blur, no spinner.
- **Select (custom listbox):** for currency. Trigger looks like an input with a CaretDown icon. Menu: white, radius-md, menu shadow, 44px options, check icon on the selected one, custom scrollbar.
- **Checkbox:** 20px box, radius 6, 1px control border, checked = pine fill + white Check icon (bold), focus ring. Label is clickable, 44px hit area.
- **Radio:** 20px circle, checked = pine ring with a 10px dot. For "who pays return shipping" use a 2-option radio card group (Buyer, Seller).
- **Chips (examples):** radius-full, 36px tall, Phosphor icon + label, neutral border, hover primary-50.
- **Cards:** surface, 1px `--border`, radius-lg, padding 24, card shadow.
- **Status chip:** radius-full, 28px, icon 16px + text 14px/500.
- **Tooltip (replaces `title` attribute):** primary-950 bg, white text, radius-sm, 8px/12px padding.
- **Toast:** bottom center on mobile, bottom right on desktop. Icon + one line. Auto close 5s.
- **Scrollbar (global, on every scroll container including textarea and menus):**
  ```
  * { scrollbar-width: thin; scrollbar-color: var(--neutral-400) transparent; }
  *::-webkit-scrollbar { width: 10px; height: 10px; }
  *::-webkit-scrollbar-track { background: transparent; }
  *::-webkit-scrollbar-thumb { background: var(--neutral-400); border-radius: 999px; border: 3px solid transparent; background-clip: content-box; }
  *::-webkit-scrollbar-thumb:hover { background: var(--neutral-600); background-clip: content-box; }
  ```
- **Also restyle:** `::selection` (primary-100 bg, neutral-900 text), `caret-color` primary-700, autofill (`:-webkit-autofill` background to surface, no yellow or blue), links (primary-700, underline, offset 3px), `details/summary` markers, `hr`, and the textarea resize grip (disabled).
- **Never ship:** native `<select>`, `input[type=number]` spinners, native checkbox/radio, `title` tooltips, browser focus outlines without a replacement.

## 7. Icons: Phosphor only
- Package `@phosphor-icons/react` (use its SSR-safe entry in server components; verify in the docs). No emoji, no icon fonts, no text arrows or glyph symbols (no arrow characters). Use `ArrowRight` etc.
- Weight: `regular` by default, `fill` for status and checked states, `bold` only for 14px icons. No duotone. Size 20 (UI), 16 (inside chips), 24 (empty states). Color inherits `currentColor`.
- Suggested icons (verify each name exists): examples Bicycle, Handbag, Laptop; test mode chip Flask; new deal Plus; draft button ArrowRight; steps Wallet, Package, Truck, SealCheck, HandCoins; fields Tag, UserCircle, EnvelopeSimple; link row Copy, Check, Lock; stepper Minus, Plus; select CaretDown; statuses Hourglass, Lock, Truck, SealCheck, ArrowUUpLeft, Warning.

## 8. Copy deck (English UI)
Rules: sentence case, plain words, active voice, buttons start with a verb, no exclamation marks, no emoji, **no em dash or en dash**, no arrow characters. Address the seller as "you".

**Header:** logo; chip `Test mode` (Flask icon, tooltip: "Payments use the PayPal sandbox. No real money moves."); button `New deal`.

**Page (left pane top):** h1 `Start a protected deal`. Sub: `Describe what you are selling. Referee holds the buyer's payment and releases it only after delivery is confirmed.`

**Step 1 card:** title `Describe your deal`. Helper: `Write it like a message to your buyer. We turn it into clear terms you can edit.` Examples label `Try an example`; chips `Folding bike, $80, no returns`, `Leather bag, $75, 7-day returns`, `Laptop, $450, high value`. Placeholder: `Example: I am selling a handmade leather wallet to Maya for $80. I will ship within 3 days. It should arrive within 14 days. She can return it within 7 days.` Button `Fill in the terms`. Note: `Works in English, Indonesian and other languages.` Loading: `Reading your description`. Success: `Terms filled in. Please check them before you continue.` Error: `We could not read that. Try adding the item, the price and when it will arrive.`

**How it works (4 steps):** `Buyer pays. The payment is held, not sent.` / `You ship and add the tracking number.` / `Referee checks the delivery on the carrier's page.` / `You get paid when delivery is confirmed.`

**Step 2 card:** title `Review the terms`.
- Group `What is being sold`: `Item name`; `Price`; `Currency`; `Description` (helper: `The buyer sees this before paying.`).
- Group `Who is involved`: `Your name`; `Your PayPal email` (helper: `You are paid here after delivery is confirmed.`); `Buyer name (optional)`.
- Group `Timing and protection`: `Ship within` + `days` (helper: `Add tracking by this deadline or the buyer is refunded.`); `Arrive within` + `days` (helper: `Delivery must be confirmed by this deadline.`); `Buyer review period` + `days` (helper: `The buyer can report a problem. After this, payment is released.`); checkbox `Accept returns`; `Return window` + `days`; radio `Return shipping paid by` with `Buyer`, `Seller`.
- Live summary (updates as they type): `The buyer pays $80.00. You are paid after delivery is confirmed and the 2-day review ends. If you do not ship within 3 days, the buyer is refunded.`
- Button: `Create deal` (when valid, append the price: `Create deal for $80.00`). Under it: `You get two links: one for you and one to send to the buyer.`
- Validation: `Add an item name.` / `Enter a price above zero.` / `Enter a valid PayPal email.` / `Choose a number of days between 1 and 60.`

**Success state (step 3):** title `Your deal is ready`. Rows: `Your link` (Lock icon, helper `Keep this private. You use it to add tracking.`) and `Buyer link` (helper `Send this to the buyer so they can pay.`), each with a `Copy` button that becomes `Copied`. Button `Open deal room`. Link `Create another deal`.

**Deal room status labels:** `Waiting for payment`, `Payment held`, `Shipped`, `Delivered, review period open`, `Released to seller`, `Refunded to buyer`, `Needs review`. Tab names: `Evidence`, `Decisions`. Decision card heading: `What Referee decided`, with `Why` text and the cited clauses and evidence as chips. Empty evidence: `Nothing yet. Evidence appears here after the item ships.`

**Footer (compact):** `Referee. Test mode, no real money moves.` and `AI drafts the terms. Always review them before you continue.` Remove the "Gemini Powered" label from the UI.

## 9. Acceptance checklist
- [ ] Palette, fonts, radius, spacing only from tokens. No off-scale values.
- [ ] Logo and favicon wired in. Reversed logo used on pine.
- [ ] No emoji, no em dash, no en dash, no arrow characters anywhere in `src` (run `pnpm check:ui`).
- [ ] Zero native form controls and zero native scrollbars visible.
- [ ] Create Deal has no page scroll at 1440x900 and 1280x720; two panes at >= 768; sticky action bar on mobile.
- [ ] Keyboard only: every control reachable, focus ring visible, steppers respond to arrows, select opens with Enter/Space.
- [ ] Contrast AA on all text; control borders >= 3:1.
- [ ] `prefers-reduced-motion` respected.
- [ ] Business logic, API routes, agent code, and policy engine unchanged.
