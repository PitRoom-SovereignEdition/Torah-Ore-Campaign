# Going live: enabling the payment system

You will move through three stages. Do not skip ahead. `/admin → Overview` shows a checklist that mirrors this.

## Stage 0: Decide who gets the money (before any code)

- The Stripe account must belong to **the yeshiva** (its legal entity, its bank account). Confirm with the yeshiva's
  accountant/board and with Stripe (nonprofit pricing can be requested from Stripe sales; do not assume a discount).
- Decide how **tax receipts** are handled (this site only sends a confirmation email). Put the approved wording in
  Admin → Campaign → Receipt footer, plus legal name, registration number and a terms URL.
- Compare real costs (platform's quoted terms vs. Stripe's rate for your card mix/currencies + hosting). No savings
  figure is assumed anywhere in this project.

## Stage 1: Demo (no money)

`PAYMENTS_MODE=demo`. Click through everything with the yeshiva's people. Edit content in Admin → Campaign.

## Stage 2: Deploy for real, with Stripe **test** keys

1. **Supabase**: create a project; run `supabase/migrations/0001_init.sql` in the SQL editor.
2. **Hosting** (e.g. Vercel): import the repo, set env vars (see `.env.example`):
   - `STORE=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose it)
   - `NEXT_PUBLIC_SITE_URL=https://your-domain`
   - `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` (`openssl rand -hex 24`)
   - `PAYMENTS_MODE=stripe`, `STRIPE_SECRET_KEY=sk_test_…`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…`
3. **Stripe → Developers → Webhooks**: add endpoint `https://your-domain/api/webhooks/stripe` with events
   `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`.
   Copy the signing secret into `STRIPE_WEBHOOK_SECRET`. **Without it no donation is ever confirmed.**
4. **Bot protection** (strongly recommended, card-testing attacks target donation forms): create a free Cloudflare
   Turnstile or hCaptcha site and set `CAPTCHA_PROVIDER`, `CAPTCHA_SECRET_KEY`, `NEXT_PUBLIC_CAPTCHA_SITE_KEY`.
   Also enable your host's firewall/rate limiting on `/api/donate`.
5. **Email** (optional): `RESEND_API_KEY`, `MAIL_FROM` (verified sender domain).
6. **Test checklist**, with Stripe test cards (`4242 4242 4242 4242`; `4000 0000 0000 9995` declines):
   - [ ] Successful gift → appears on the wall and in the total only after the webhook; `/thanks` shows confirmed.
   - [ ] Declined card → no wall entry, status `failed`, total unchanged.
   - [ ] Refund from Admin → donation `refunded`, total drops, matcher cap frees up.
   - [ ] Replay the same webhook event in Stripe → nothing double counts.
   - [ ] Hebrew + mobile + Apple/Google Pay (enable wallets in the Stripe dashboard) look right.
   - [ ] Offline gift, matcher, team sign-up → approve → team page → gift credited "With X".
   - [ ] `/admin → Overview` shows no red FIX rows for test keys.

## Stage 3: Real money

1. In Stripe, complete account activation (business details, bank payout) for the **yeshiva's** account.
2. Swap to live keys: `STRIPE_SECRET_KEY=sk_live_…`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…`, and create a
   **live-mode** webhook endpoint (live and test have different signing secrets). Redeploy.
3. Admin → Overview: every blocking row should read OK ("Key pair matches", HTTPS, webhook secret, Supabase…).
4. Make one small real gift yourself, confirm it lands, refund it, confirm the refund.
5. Announce the campaign.

## Turning it off

Set `PAYMENTS_MODE=disabled` and redeploy: the Donate button reads "opening soon" and `/api/donate` refuses
requests. Already-completed gifts remain. Webhooks continue to reconcile refunds/late confirmations.

## Operating notes

- **Flagged** gifts (amount mismatch) never count. Investigate in Stripe, then refund or fix manually.
- Rotating the Stripe or admin secrets: change env vars and redeploy. Admin sessions expire after 8 hours.
- Donor data export contains private contact details (Admin → Donations → CSV). Treat it accordingly.
