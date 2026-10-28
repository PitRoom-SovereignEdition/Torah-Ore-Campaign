# Yeshiva Campaign Site

A self-hosted fundraising campaign site for a yeshiva, so the yeshiva doesn't have to depend on a third-party
campaign platform. It has a live goal card, donor wall, teams/ambassadors, matchers, Hebrew/English (RTL), an admin
panel, and an **opt-in payment system** that is OFF until you switch it on.

Structure and features follow `docs/build-brief.md` (a brief reconstructed from public pages of an existing
platform). Artwork, copy and styling are original. This is not a copy of anyone's design or assets.

## Try it in 2 minutes (no money, no accounts)

```bash
npm install
cp .env.example .env.local        # PAYMENTS_MODE=demo is the default in the example
# in .env.local also set:  ADMIN_PASSWORD=choose-something  and  ADMIN_SESSION_SECRET=$(openssl rand -hex 24)
npm run seed                      # optional: clearly-fake demo donors (local JSON store only)
npm run dev                       # http://localhost:3000   admin: /admin
```

In **demo mode** the Donate button works end-to-end, but there are no card fields and no money moves: the
last step is a "Simulate successful payment" button, and a yellow banner says so on every page.

## The payment switch

Payments are controlled by environment variables only (never a button on the site), so enabling real money is a
deliberate, reviewable deploy:

| `PAYMENTS_MODE` | What happens |
| --- | --- |
| `disabled` (default if unset) | Donate button reads "opening soon". Nothing can be charged. |
| `demo` | Fake checkout, no money, clearly labelled. For demos and testing the UI. |
| `stripe` | Real Stripe checkout. `sk_test_…` / `pk_test_…` keys = Stripe test mode (still no real money). `sk_live_…` = real money. |

`/admin → Overview` shows a live **readiness checklist** (database, keys match, webhook secret, https, admin
protection, CAPTCHA, email…) so you can see exactly what's missing before real money. Full steps:
**[docs/GO-LIVE.md](docs/GO-LIVE.md)**.

## What's built

- **Campaign page**: hero (image or Vimeo/YouTube), goal card with progress bar that polls live, bonus-goal state
  (trophy once the goal is passed), description with "More…", tabs for Donors / Teams / Matchers / About.
- **Donor wall**: search, Latest / Highest / Most-liked, paging, avatar initials, "With {team}" attribution,
  dedication (🕯️), anonymous gifts, opt-out of the public wall, anonymous likes.
- **Donation modal**: preset + free amount, currency picker with conversion note, donor details, wall message,
  dedication, anonymous / show-on-wall, terms checkbox, statement descriptor + registration number, optional CAPTCHA.
  Card entry is Stripe's own embedded Payment Element (cards, Apple Pay, Google Pay as enabled in your Stripe
  dashboard). Card data never touches this server.
- **Teams**: public sign-up form (5 fields) → admin approves → team page `/t/{id}` with its own goal card and wall;
  gifts made there are credited ("With X"); leaderboard table.
- **Matchers**: multiplier + cap + time window, tracked separately from cash (see "Money rules").
- **Admin** (`/admin`): totals, readiness checklist, donations table with refunds, CSV export, offline gifts
  (cheque / cash / DAF / voucher), team approval, matcher management, campaign settings (title, goal, bonus goal,
  dates, currencies + rates, charity details, receipt footer).
- **Hebrew / English** with RTL; dark mode; mobile layout; keyboard-accessible.

## Money rules (enforced in code + tests)

- Raw card numbers never touch our forms or server. Stripe's iframe only.
- Amount, currency, FX and team are validated and **priced server-side**; the browser never sets the charge.
- A donation becomes `succeeded` **only** from the signature-verified, idempotent Stripe webhook (or demo confirm in
  demo mode). The browser redirect to `/thanks` only reads status. Amount mismatches are `flagged`, not counted.
  Illegal transitions (e.g. a late failure after a success, or un-refunding) are refused.
- The public wall shows only display name, amount, message, dedication and team, and only for consenting
  gifts. Emails and addresses are never in any public API response (tested). In Supabase, RLS is enabled
  with no public policies, so even the public API key can't read donor details.
- Matching is **computed** from real succeeded cash, a per-matcher cap, window and currency, and kept as a separate
  total. No fake "system donation" rows are ever created. Refunds automatically free matcher cap.
- Seeding refuses to run against Supabase or with `PAYMENTS_MODE=stripe`.

## Stack

Next.js 15 (App Router) · TypeScript · Stripe · Supabase (Postgres) for production · plain CSS · Vitest.
Local/demo uses a JSON file store; production uses Supabase (`supabase/migrations/0001_init.sql`).

```bash
npm run check     # typecheck + 27 tests
npm run build
```

## Known limits (be honest with the yeshiva)

- **No recurring/monthly gifts yet** (one-time only). Planned as Stripe Subscriptions.
- **Multi-currency**: totals use admin-set fixed rates recorded per gift, and the card is charged in the donor's
  chosen currency. What lands in your bank depends on Stripe's settlement currency and FX fees. Matching is
  campaign-currency only.
- **No formal tax receipts**: donors get a confirmation email only. Legal receipt wording, the legal payee and
  whose Stripe account receives the money are for the yeshiva to settle with its own advisers and Stripe.
  Receipt wording can be added in Admin → Campaign → Receipt footer.
- **DAF / voucher platforms** (OJC, Donors' Fund, Achisomoch, …) are entered by an admin as offline gifts; there are no
  direct integrations.
- **Scale**: totals/wall are computed from the donation list with a 5-second cache and an in-memory rate limiter.
  That is comfortable for thousands of donors; for tens of thousands plus heavy live traffic, move totals into a SQL
  aggregate and use a shared rate limiter (Vercel firewall / Upstash). The brief flags this as a hard part.
- The Stripe path is unit-tested (signed webhooks, replays, tampering, refunds) but has **not** been exercised
  against Stripe's live servers from this repo. Run the Stripe test-mode checklist in `docs/GO-LIVE.md` first.

## Previewing without hosting anything

`preview/index.html` is a single self-contained file (rebuilt from the real app CSS and photos by `python3 scripts/build-preview.py`): a clickable demo of the donor site and admin panel. It runs entirely in the browser on demo data, with no server and no payments. As an Artifact it also saves gifts, likes and team sign-ups to a shared store.
data (no server, no payments). Open it in any browser, or publish it anywhere that serves static files.
To see the real app instead, follow "Try it in 2 minutes" above.
