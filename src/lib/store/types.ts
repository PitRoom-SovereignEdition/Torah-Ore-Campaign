import type { AuditEntry, Campaign, Donation, Matcher, Team } from "../types";

export interface Store {
  getCampaign(): Promise<Campaign>;
  saveCampaign(patch: Partial<Campaign>): Promise<Campaign>;

  listTeams(): Promise<Team[]>;
  getTeam(id: string): Promise<Team | null>;
  createTeam(t: Team): Promise<void>;
  updateTeam(id: string, patch: Partial<Team>): Promise<void>;

  createDonation(d: Donation): Promise<void>;
  getDonation(id: string): Promise<Donation | null>;
  findDonationByPaymentRef(ref: string): Promise<Donation | null>;
  updateDonation(id: string, patch: Partial<Donation>): Promise<Donation | null>;
  listDonations(): Promise<Donation[]>;

  listMatchers(): Promise<Matcher[]>;
  createMatcher(m: Matcher): Promise<void>;
  deleteMatcher(id: string): Promise<void>;

  /** Returns true if the like was newly added. One like per (donation, voter). */
  addLike(donationId: string, voterHash: string): Promise<boolean>;
  likeCounts(): Promise<Record<string, number>>;

  /** Append-only. There is deliberately no update or delete. */
  appendAudit(e: AuditEntry): Promise<void>;
  listAudit(limit: number): Promise<AuditEntry[]>;

  /** Idempotency ledger for webhooks. Returns true the first time an id is seen. */
  recordEvent(eventId: string): Promise<boolean>;
  forgetEvent(eventId: string): Promise<void>;
}
