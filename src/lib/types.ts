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
}

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
