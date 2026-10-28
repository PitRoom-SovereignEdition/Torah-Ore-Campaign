export type DonationStatus = "pending" | "succeeded" | "failed" | "refunded" | "flagged";
export type PaymentProvider = "stripe" | "demo" | "offline";

export interface Campaign {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  longDescription: string;
  /** Goal, in minor units of `currency`. */
  goalCents: number;
  bonusGoalCents: number | null;
  /** Campaign (reporting) currency. All totals are expressed in this currency. */
  currency: string;
  /** Extra currencies donors may pay in, with a rate to `currency` used for totals + display. */
  fxRates: Record<string, number>;
  startsAt: string | null;
  endsAt: string | null;
  heroMedia: string[];
  videoUrl: string | null;
  charityName: string;
  charityRegNo: string;
  statementDescriptor: string;
  receiptFooter: string;
  termsUrl: string;
  contactEmail: string;
  /** What "winning" means on the team leaderboard. Must be chosen by the charity before launch. */
  leaderboardBasis: LeaderboardBasis;
  /** Whether a fundraiser's own gift to their own page counts toward their ranking. */
  selfDonation: "count" | "exclude";
  /** Published contest cutoff. Rankings are provisional until then. */
  cutoffAt: string | null;
  /** Public contest rules. Blank = auto-generated from the settings above. */
  leaderboardRules: string;
}

export type LeaderboardBasis = "money" | "gifts" | "donors";
export type Role = "organizer" | "finance";
export type ReviewState = "none" | "open" | "cleared" | "excluded";
export type DisputeState = "none" | "open" | "won" | "lost";

export interface Team {
  id: string;
  campaignId: string;
  name: string;
  goalCents: number | null;
  message: string;
  ownerName: string;
  /** Private. Never sent to public pages. */
  ownerEmail: string;
  ownerPhone: string;
  approved: boolean;
  createdAt: string;
}

export interface Donation {
  id: string;
  campaignId: string;
  teamId: string | null;
  /** Amount charged, minor units of `currency`. */
  amountCents: number;
  currency: string;
  /** Amount in campaign currency, fixed at creation time using `fxRate`. */
  campaignAmountCents: number;
  fxRate: number;
  refundedCents: number;
  // Public (only shown on the wall when showOnWall)
  displayName: string;
  anonymous: boolean;
  showOnWall: boolean;
  message: string;
  dedication: string;
  // Private donor details
  donorName: string;
  donorEmail: string;
  reference: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  /** Internal donor identity. Defaults to a hash of the email; organizers can merge/split with a logged reason. */
  donorId: string;
  /** Salted hash of the requester IP (never the IP itself). Weak signal only: shared networks are normal. */
  ipHash: string;
  /** Processor card fingerprint (not a card number). Only when the processor provides one. */
  cardFingerprint: string | null;
  cardChecks: { cvc?: string | null; postal?: string | null; line1?: string | null } | null;
  cardFunding: string | null;
  cardCountry: string | null;
  /** Private to organizers/finance. Never in any public API. */
  reviewState: ReviewState;
  signals: string[];
  disputeState: DisputeState;
  /** Offline gifts: who entered it, and the different person who verified it. */
  enteredBy: string | null;
  verifiedBy: string | null;
  provider: PaymentProvider;
  paymentRef: string | null;
  status: DonationStatus;
  /** Demo-mode donations are never real money. */
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Matcher {
  id: string;
  campaignId: string;
  name: string;
  /**
   * Extra dollars added per dollar of cash donation. 1 = dollar-for-dollar,
   * 2 = the matcher adds $2 for every $1 donated.
   */
  multiplier: number;
  /** Maximum total this matcher will add, minor units of `currency`. */
  capCents: number;
  currency: string;
  windowStart: string;
  windowEnd: string;
}

export interface MatcherProgress {
  matcher: Matcher;
  matchedCents: number;
  remainingCents: number;
}

export interface Totals {
  /** Real cash raised, campaign currency. Never includes matched amounts. */
  cashCents: number;
  /** Amount added by matchers, computed from cash donations + matcher caps. Kept separate. */
  matchedCents: number;
  donorCount: number;
  teamTotals: Record<string, { cashCents: number; count: number }>;
  matchers: MatcherProgress[];
}

/** What the browser is allowed to see for a donor-wall entry. No emails, no addresses. */
export interface PublicDonation {
  id: string;
  displayName: string;
  initials: string;
  amountCents: number;
  currency: string;
  message: string;
  dedication: string;
  teamId: string | null;
  teamName: string | null;
  likes: number;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  /** "organizer", "finance", or "system" (webhooks). */
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: Record<string, unknown>;
}
