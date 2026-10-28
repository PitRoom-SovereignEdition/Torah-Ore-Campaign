import { z } from "zod";
import { limits, paymentsMode } from "./config";
import { audit } from "./audit";
import { newId, nowIso, sha256 } from "./ids";
import { evaluateSignals, norm } from "./risk";
import { rankTeams, type BoardRow } from "./leaderboard";
import { computeTotals, effectiveCents } from "./matching";
import { convertCents, initialsOf, isSupportedCurrency } from "./money";
import { getStore } from "./store";
import type { Campaign, Donation, DonationStatus, PublicDonation, Totals } from "./types";

const clean = (max: number) => z.string().trim().max(max).default("");

export const donateSchema = z.object({
  amount: z.number().positive(), // major units typed by the donor; converted + validated below
  currency: z.string().length(3),
  teamId: z.string().max(64).nullish(),
  donorName: z.string().trim().min(1).max(120),
  donorEmail: z.string().trim().email().max(200),
  reference: clean(120),
  address: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  state: clean(100),
  zip: clean(30),
  country: z.string().trim().min(2).max(100),
  anonymous: z.boolean().default(false),
  showOnWall: z.boolean().default(true),
  message: clean(300),
  dedication: clean(200),
  acceptTerms: z.literal(true),
  captchaToken: z.string().max(4000).optional(),
  /** Honeypot: real users never fill this in. */
  website: z.string().max(0).optional(),
});
export type DonateInput = z.infer<typeof donateSchema>;

export class DonationError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Default identity key. Organizers can merge or split donors manually (logged); see docs/FRAUD-AND-LEADERBOARD.md. */
export const donorIdFor = (email: string) => "d_" + sha256(norm(email)).slice(0, 16);

export const riskDefaults = () => ({
  cardFingerprint: null,
  cardChecks: null,
  cardFunding: null,
  cardCountry: null,
  reviewState: "none" as const,
  signals: [] as string[],
  disputeState: "none" as const,
  enteredBy: null,
  verifiedBy: null,
});

export function campaignOpen(c: Campaign, now = new Date()): boolean {
  if (c.startsAt && now < new Date(c.startsAt)) return false;
  if (c.endsAt && now > new Date(c.endsAt)) return false;
  return true;
}

export function rateFor(c: Campaign, currency: string): number | null {
  if (currency === c.currency) return 1;
  const r = c.fxRates[currency];
  return typeof r === "number" && r > 0 ? r : null;
}

/**
 * Turn validated browser input into a pending Donation. All pricing decisions are made here
 * on the server: amount bounds, currency allow-list, FX rate, team attribution.
 */
export async function buildPendingDonation(c: Campaign, input: DonateInput, ipHash = ""): Promise<Donation> {
  if (!campaignOpen(c)) throw new DonationError("This campaign is not currently accepting donations.", 409);
  const currency = input.currency.toUpperCase();
  const rate = isSupportedCurrency(currency) ? rateFor(c, currency) : null;
  if (rate === null) throw new DonationError("That currency is not supported.");

  const amountCents = Math.round(input.amount * 100);
  const campaignAmountCents = convertCents(amountCents, rate);
  if (!Number.isSafeInteger(amountCents) || campaignAmountCents < limits.minCents || campaignAmountCents > limits.maxCents) {
    throw new DonationError("That amount is outside the allowed range.");
  }

  let teamId: string | null = null;
  if (input.teamId) {
    const team = await getStore().getTeam(input.teamId);
    if (!team || !team.approved) throw new DonationError("Unknown team.");
    teamId = team.id;
  }

  const mode = paymentsMode();
  const ts = nowIso();
  return {
    id: newId(),
    campaignId: c.id,
    teamId,
    amountCents,
    currency,
    campaignAmountCents,
    fxRate: rate,
    refundedCents: 0,
    displayName: input.anonymous ? "Anonymous" : input.donorName,
    anonymous: input.anonymous,
    showOnWall: input.showOnWall,
    message: input.message,
    dedication: input.dedication,
    donorName: input.donorName,
    donorEmail: input.donorEmail,
    reference: input.reference,
    address: input.address,
    city: input.city,
    state: input.state,
    zip: input.zip,
    country: input.country,
    donorId: donorIdFor(input.donorEmail),
    ipHash,
    ...riskDefaults(),
    provider: mode === "stripe" ? "stripe" : "demo",
    paymentRef: null,
    status: "pending",
    isDemo: mode !== "stripe",
    createdAt: ts,
    updatedAt: ts,
  };
}

const ALLOWED: Record<DonationStatus, DonationStatus[]> = {
  pending: ["succeeded", "failed", "flagged"],
  failed: ["succeeded"], // Stripe lets a customer retry the same intent
  succeeded: ["refunded"],
  refunded: [],
  flagged: ["succeeded", "refunded"],
};

export type PaymentEvent =
  | { type: "succeeded"; paymentRef: string; amountCents: number; currency: string }
  | { type: "failed"; paymentRef: string }
  | { type: "refunded"; paymentRef: string; refundedCents: number }
  | { type: "card"; paymentRef: string; fingerprint: string | null; checks: Donation["cardChecks"]; funding: string | null; country: string | null }
  | { type: "dispute"; paymentRef: string; state: "open" | "won" | "lost" };

/**
 * The ONLY path by which a donation becomes "succeeded". Called from the signature-verified Stripe
 * webhook (or the demo confirm endpoint). It is idempotent and refuses illegal transitions, so
 * replayed or out-of-order events cannot double-count or resurrect a refund.
 */
export async function applyPaymentEvent(ev: PaymentEvent): Promise<{ donation: Donation | null; changed: boolean }> {
  const store = getStore();
  const d = await store.findDonationByPaymentRef(ev.paymentRef);
  if (!d) return { donation: null, changed: false };

  if (ev.type === "card") {
    const next = await store.updateDonation(d.id, { cardFingerprint: ev.fingerprint, cardChecks: ev.checks, cardFunding: ev.funding, cardCountry: ev.country });
    return { donation: next, changed: true };
  }

  if (ev.type === "dispute") {
    if (ev.state === "lost") {
      // Funds are gone: treat as a full reversal so rankings and totals fall back to the ledger.
      const r = await applyPaymentEvent({ type: "refunded", paymentRef: ev.paymentRef, refundedCents: d.amountCents });
      const next = await store.updateDonation(d.id, { disputeState: "lost" });
      return { donation: next, changed: r.changed || true };
    }
    if (d.disputeState === ev.state) return { donation: d, changed: false };
    // Won or open: recorded separately. Nothing is auto-excluded; a reviewer decides.
    const patch: Partial<Donation> = { disputeState: ev.state };
    if (ev.state === "open" && d.reviewState === "none") patch.reviewState = "open";
    return { donation: await store.updateDonation(d.id, patch), changed: true };
  }

  if (ev.type === "succeeded") {
    if (d.status === "succeeded") return { donation: d, changed: false };
    // Never trust the event over our own record of what we priced.
    if (ev.amountCents !== d.amountCents || ev.currency.toUpperCase() !== d.currency) {
      const flagged = await store.updateDonation(d.id, { status: "flagged" });
      console.error(`[payments] amount mismatch for donation ${d.id}: expected ${d.amountCents} ${d.currency}, got ${ev.amountCents} ${ev.currency}`);
      return { donation: flagged, changed: true };
    }
    if (!ALLOWED[d.status].includes("succeeded")) return { donation: d, changed: false };
    return { donation: await store.updateDonation(d.id, { status: "succeeded" }), changed: true };
  }

  if (ev.type === "failed") {
    if (!ALLOWED[d.status].includes("failed")) return { donation: d, changed: false };
    return { donation: await store.updateDonation(d.id, { status: "failed" }), changed: true };
  }

  // refunded: cumulative refunded amount reported by the processor
  if (d.status !== "succeeded" && d.status !== "flagged" && d.status !== "refunded") return { donation: d, changed: false };
  const refundedCents = Math.min(Math.max(ev.refundedCents, d.refundedCents), d.amountCents);
  if (refundedCents === d.refundedCents) return { donation: d, changed: false };
  const full = refundedCents >= d.amountCents;
  return {
    donation: await store.updateDonation(d.id, { refundedCents, status: full ? "refunded" : d.status }),
    changed: true,
  };
}

/**
 * Re-evaluate review signals for a confirmed gift. A weak suspicion opens a review; it never excludes
 * anything by itself. Already-cleared gifts are not reopened by this.
 */
export async function assessDonation(id: string): Promise<void> {
  const store = getStore();
  const d = await store.getDonation(id);
  if (!d || d.status !== "succeeded") return;
  const [all, teams] = await Promise.all([store.listDonations(), store.listTeams()]);
  const { signals, open } = evaluateSignals(d, all, teams);
  const same = signals.length === d.signals.length && signals.every((x) => d.signals.includes(x));
  const opening = open && d.reviewState === "none";
  if (same && !opening) return;
  await store.updateDonation(id, { signals, ...(opening ? { reviewState: "open" as const } : {}) });
  if (opening) await audit("system", "review.opened", "donation", id, { signals });
}

// ---- reads ---------------------------------------------------------------------------------

/** Demo gifts are fake. Once real payments are on they must never count toward totals or the wall. */
export function countable(donations: Donation[]): Donation[] {
  return paymentsMode() === "stripe" ? donations.filter((d) => !d.isDemo) : donations;
}

let totalsCache: { at: number; value: Totals } | null = null;
/** Short cache so a traffic spike hits the DB once per few seconds, not once per visitor. */
export async function getTotals(c: Campaign, maxAgeMs = 5000): Promise<Totals> {
  if (totalsCache && Date.now() - totalsCache.at < maxAgeMs) return totalsCache.value;
  const store = getStore();
  const [donations, matchers] = await Promise.all([store.listDonations(), store.listMatchers()]);
  const value = computeTotals(countable(donations), matchers, c.currency);
  totalsCache = { at: Date.now(), value };
  return value;
}
export function invalidateTotals() {
  totalsCache = null;
  boardCache = null;
}

let boardCache: { at: number; value: BoardRow[] } | null = null;
/** Official team ranking under the charity's published rule. Same short cache as totals. */
export async function getLeaderboard(c: Campaign, maxAgeMs = 5000): Promise<BoardRow[]> {
  if (boardCache && Date.now() - boardCache.at < maxAgeMs) return boardCache.value;
  const store = getStore();
  const [donations, teams] = await Promise.all([store.listDonations(), store.listTeams()]);
  const value = rankTeams(countable(donations), teams, c);
  boardCache = { at: Date.now(), value };
  return value;
}

export type WallSort = "latest" | "highest" | "liked";

export async function getWall(opts: {
  campaign: Campaign;
  sort: WallSort;
  q: string;
  teamId: string | null;
  offset: number;
  limit: number;
}): Promise<{ items: PublicDonation[]; total: number }> {
  const store = getStore();
  const [donations, teams, likes] = await Promise.all([store.listDonations(), store.listTeams(), store.likeCounts()]);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const q = opts.q.trim().toLowerCase();

  let rows = countable(donations).filter((d) => d.status === "succeeded" && d.showOnWall && effectiveCents(d) > 0);
  if (opts.teamId) rows = rows.filter((d) => d.teamId === opts.teamId);
  if (q) rows = rows.filter((d) => d.displayName.toLowerCase().includes(q) || d.message.toLowerCase().includes(q));

  const cmp: Record<WallSort, (a: Donation, b: Donation) => number> = {
    latest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    highest: (a, b) => b.campaignAmountCents - a.campaignAmountCents || b.createdAt.localeCompare(a.createdAt),
    liked: (a, b) => (likes[b.id] ?? 0) - (likes[a.id] ?? 0) || b.createdAt.localeCompare(a.createdAt),
  };
  rows.sort(cmp[opts.sort]);

  const items = rows.slice(opts.offset, opts.offset + opts.limit).map(
    (d): PublicDonation => ({
      id: d.id,
      displayName: d.anonymous ? "Anonymous" : d.displayName,
      initials: d.anonymous ? "?" : initialsOf(d.displayName),
      amountCents: d.amountCents,
      currency: d.currency,
      message: d.message,
      dedication: d.dedication,
      teamId: d.teamId,
      teamName: d.teamId ? (teamName.get(d.teamId) ?? null) : null,
      likes: likes[d.id] ?? 0,
      createdAt: d.createdAt,
    }),
  );
  return { items, total: rows.length };
}
