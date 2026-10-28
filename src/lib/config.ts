import type { Campaign } from "./types";

/**
 * Payment states, controlled entirely by environment variables so that turning real
 * payments on is an explicit, reviewable act:
 *
 *   PAYMENTS_MODE=disabled  (default) donate button shows "opening soon"; nothing can be charged
 *   PAYMENTS_MODE=demo      fake checkout, no card fields at all, no real money, clearly labelled
 *   PAYMENTS_MODE=stripe    real Stripe checkout; needs STRIPE_* keys. sk_test_ keys = Stripe test mode
 */
export type PaymentsMode = "disabled" | "demo" | "stripe";

export function paymentsMode(): PaymentsMode {
  // Zero-config preview deploy (Vercel, nothing configured): fake checkout so the site is explorable.
  // The moment any Stripe key or an explicit mode is set, this no longer applies.
  const zeroConfig = !!process.env.VERCEL && !process.env.STRIPE_SECRET_KEY && !process.env.STORE;
  const m = (process.env.PAYMENTS_MODE ?? (zeroConfig ? "demo" : "disabled")).toLowerCase();
  if (m === "demo" || m === "stripe") return m;
  return "disabled";
}

export function stripeKeyKind(): "test" | "live" | "missing" {
  const k = process.env.STRIPE_SECRET_KEY ?? "";
  if (k.startsWith("sk_live_") || k.startsWith("rk_live_")) return "live";
  if (k.startsWith("sk_test_") || k.startsWith("rk_test_")) return "test";
  return "missing";
}

export const limits = {
  minCents: Number(process.env.MIN_DONATION_CENTS ?? 100),
  maxCents: Number(process.env.MAX_DONATION_CENTS ?? 100_000_00),
};

export const siteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Default campaign content. Edit here, or override live from /admin → Campaign. */
export const defaultCampaign: Campaign = {
  id: "main",
  title: "Our Yeshiva | Above & Beyond",
  subtitle: "Annual Campaign",
  description:
    "Help us strengthen Torah learning for the next generation. Every gift, big or small, goes straight to our talmidim, rabbeim and facilities.",
  longDescription:
    "This is the yeshiva's annual campaign. Replace this text from the admin panel (Campaign tab) with your own story, goals and what donations fund. Teams of supporters raise funds from their own networks, and generous matchers multiply every gift while their pledges last.",
  goalCents: 360_000_00,
  bonusGoalCents: 500_000_00,
  currency: "USD",
  fxRates: { GBP: 1.3, EUR: 1.1, CAD: 0.73, ILS: 0.27 },
  startsAt: null,
  endsAt: null,
  heroMedia: ["/hero/group.jpg", "/hero/dancing.jpg"],
  videoUrl: null,
  charityName: "Our Yeshiva",
  charityRegNo: "",
  statementDescriptor: "YESHIVA",
  receiptFooter: "",
  termsUrl: "",
  contactEmail: "",
  leaderboardBasis: "money",
  selfDonation: "count",
  cutoffAt: null,
  leaderboardRules: "",
};

export function adminConfigured(): boolean {
  return !!process.env.ADMIN_PASSWORD && (process.env.ADMIN_SESSION_SECRET ?? "").length >= 16;
}

/** A second login (different password) so offline gifts can be verified by a second person. */
export function financeConfigured(): boolean {
  return adminConfigured() && !!process.env.FINANCE_PASSWORD && process.env.FINANCE_PASSWORD !== process.env.ADMIN_PASSWORD;
}

/** Organizers see donor contact details only if the charity decides so. Finance always does. */
export function organizerSeesContact(): boolean {
  return process.env.ORGANIZER_SEES_CONTACT === "true";
}
