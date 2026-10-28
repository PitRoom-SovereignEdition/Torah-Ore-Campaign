import { captchaProvider } from "./captcha";
import { financeConfigured, paymentsMode, siteUrl, stripeKeyKind } from "./config";
import type { Campaign } from "./types";

export interface Check { id: string; label: string; status: "ok" | "warn" | "bad"; detail: string; blocksLive: boolean }

/** Shown in /admin so "is it safe to take real money?" is a visible, checkable thing. */
export function readiness(c: Campaign): { checks: Check[]; liveReady: boolean } {
  const mode = paymentsMode();
  const key = stripeKeyKind();
  const https = siteUrl().startsWith("https://");
  const checks: Check[] = [
    { id: "store", label: "Production database", status: process.env.STORE === "supabase" ? "ok" : "bad", blocksLive: true,
      detail: process.env.STORE === "supabase" ? "Supabase store active." : "Using a temporary store (local file or in-memory preview). Data is lost on restart. Set STORE=supabase (+ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) before real money." },
    { id: "mode", label: "Payments mode", status: mode === "stripe" ? "ok" : "warn", blocksLive: false,
      detail: `PAYMENTS_MODE=${mode}` + (mode === "demo" ? " (fake checkout, no real money)" : mode === "disabled" ? " (donations closed)" : "") },
    { id: "skey", label: "Stripe secret key", status: key === "missing" ? "bad" : "ok", blocksLive: true,
      detail: key === "missing" ? "STRIPE_SECRET_KEY missing or malformed." : `Key is a ${key.toUpperCase()}-mode key.` },
    { id: "pkey", label: "Stripe publishable key", status: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? "ok" : "bad", blocksLive: true,
      detail: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? "Set." : "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY missing." },
    { id: "pk-match", label: "Key pair matches (test/test or live/live)", blocksLive: true,
      status: (() => {
        const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
        if (key === "missing" || !pk) return "bad";
        return (key === "live") === pk.startsWith("pk_live_") ? "ok" : "bad";
      })(),
      detail: "Mixing a live secret key with a test publishable key (or vice versa) breaks checkout." },
    { id: "whsec", label: "Stripe webhook secret", status: process.env.STRIPE_WEBHOOK_SECRET ? "ok" : "bad", blocksLive: true,
      detail: `Point a Stripe webhook at ${siteUrl()}/api/webhooks/stripe (events: payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled, charge.succeeded, charge.refunded, charge.dispute.created, charge.dispute.closed) and set STRIPE_WEBHOOK_SECRET. Without it no donation can ever be confirmed.` },
    { id: "https", label: "Site served over HTTPS", status: https ? "ok" : "bad", blocksLive: true,
      detail: https ? siteUrl() : `NEXT_PUBLIC_SITE_URL is ${siteUrl()}. Live payments require https.` },
    { id: "admin", label: "Admin protected", status: process.env.ADMIN_PASSWORD && (process.env.ADMIN_SESSION_SECRET ?? "").length >= 16 ? "ok" : "bad", blocksLive: true,
      detail: "ADMIN_PASSWORD plus ADMIN_SESSION_SECRET (16+ random chars)." },
    { id: "finance", label: "Second login for offline-gift verification", status: financeConfigured() ? "ok" : "warn", blocksLive: false,
      detail: financeConfigured() ? "FINANCE_PASSWORD set: offline gifts are entered by one role and verified by the other." : "Set FINANCE_PASSWORD. Without it offline gifts cannot be verified, so they cannot count." },
    { id: "radar", label: "Stripe fraud screening (Radar)", status: "warn", blocksLive: false,
      detail: "Manual: in Stripe → Radar → Rules, require CVC and postal code checks where supported, review prepaid cards, and test rules against past charges before enforcing. Do not use a 1-per-IP-per-hour rule: dorms and shared Wi-Fi have many real donors on one IP. See docs/FRAUD-AND-LEADERBOARD.md." },
    { id: "captcha", label: "Bot protection", status: captchaProvider() ? "ok" : "warn", blocksLive: false,
      detail: captchaProvider() ? `${captchaProvider()} active.` : "No CAPTCHA configured. Card-testing bots love donation forms; strongly recommended." },
    { id: "mail", label: "Confirmation emails", status: process.env.RESEND_API_KEY && process.env.MAIL_FROM ? "ok" : "warn", blocksLive: false,
      detail: process.env.RESEND_API_KEY ? "Resend configured." : "No RESEND_API_KEY / MAIL_FROM: confirmations are only logged." },
    { id: "legal", label: "Charity details on the page", status: c.charityName && c.charityRegNo && c.termsUrl ? "ok" : "warn", blocksLive: false,
      detail: "Set legal name, registration number and a terms URL in the Campaign tab. Have the yeshiva's advisers confirm the receipt wording." },
    { id: "payee", label: "Stripe account belongs to the yeshiva", status: "warn", blocksLive: false,
      detail: "Manual check: the Stripe account (and its bank payout) must be the yeshiva's own, verified with the yeshiva's advisers, so funds settle to the right payee." },
  ];
  const liveReady = checks.filter((x) => x.blocksLive).every((x) => x.status === "ok");
  return { checks, liveReady };
}
