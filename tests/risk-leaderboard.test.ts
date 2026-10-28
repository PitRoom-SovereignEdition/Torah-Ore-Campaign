import { describe, expect, it } from "vitest";
import { rankTeams, rulesText } from "@/lib/leaderboard";
import { evaluateSignals } from "@/lib/risk";
import { defaultCampaign } from "@/lib/config";
import type { Donation, Team } from "@/lib/types";

const t0 = Date.parse("2026-11-01T12:00:00Z");
let n = 0;
const gift = (over: Partial<Donation> = {}): Donation => ({
  id: `g${++n}`, campaignId: "main", teamId: "A", amountCents: 3600, currency: "USD", campaignAmountCents: 3600, fxRate: 1, refundedCents: 0,
  displayName: "X", anonymous: false, showOnWall: true, message: "", dedication: "", donorName: "X", donorEmail: `x${n}@example.com`, reference: "",
  address: `${n} Main`, city: "c", state: "", zip: `1000${n}`, country: "US", donorId: `d_${n}`, ipHash: "", cardFingerprint: null, cardChecks: null,
  cardFunding: null, cardCountry: null, reviewState: "none", signals: [], disputeState: "none", enteredBy: null, verifiedBy: null,
  provider: "stripe", paymentRef: `pi_${n}`, status: "succeeded", isDemo: false,
  createdAt: new Date(t0 + n * 1000).toISOString(), updatedAt: new Date(t0).toISOString(), ...over,
});
const team = (id: string, ownerEmail: string): Team => ({ id, campaignId: "main", name: `Team ${id}`, goalCents: null, message: "", ownerName: id, ownerEmail, ownerPhone: "", approved: true, createdAt: "" });
const teams = [team("A", "a@example.com"), team("B", "b@example.com"), team("C", "c@example.com"), team("D", "d@example.com")];

describe("review signals are reasons to look, not verdicts", () => {
  it("a shared address alone does not open a review", () => {
    const shared = Array.from({ length: 4 }, () => gift({ address: "12 Dorm Rd", zip: "11230" }));
    const r = evaluateSignals(shared[3], shared, teams);
    expect(r.signals).toContain("same_address_many");
    expect(r.open).toBe(false);
  });

  it("same card across 3 teams is a medium signal that opens a review", () => {
    const card = ["A", "B", "C"].map((tid) => gift({ teamId: tid, cardFingerprint: "fp_1" }));
    const r = evaluateSignals(card[2], card, teams);
    expect(r.signals).toContain("card_multi_team");
    expect(r.open).toBe(true);
  });

  it("two weak signals together open a review", () => {
    const d = gift({ cardChecks: { cvc: "fail", postal: "fail" } });
    const r = evaluateSignals(d, [d], teams);
    expect(r.signals).toEqual(expect.arrayContaining(["cvc_failed", "postal_failed"]));
    expect(r.open).toBe(true);
  });

  it("flags a team owner giving to their own page, but only as a weak signal", () => {
    const d = gift({ teamId: "A", donorEmail: "A@example.com " });
    const r = evaluateSignals(d, [d], teams);
    expect(r.signals).toContain("self_gift");
    expect(r.open).toBe(false);
  });

  it("detects circular giving between two team owners", () => {
    const aToB = gift({ teamId: "B", donorEmail: "a@example.com" });
    const bToA = gift({ teamId: "A", donorEmail: "b@example.com" });
    const r = evaluateSignals(bToA, [aToB, bToA], teams);
    expect(r.signals).toContain("circular_giving");
    expect(r.open).toBe(true);
  });

  it("a burst of failures from one network before a success is flagged", () => {
    const fails = Array.from({ length: 5 }, () => gift({ status: "failed", ipHash: "ip1", amountCents: 100 }));
    const ok = gift({ ipHash: "ip1" });
    expect(evaluateSignals(ok, [...fails, ok], teams).signals).toContain("success_after_failures");
  });

  it("an offline gift matching a recent online gift is flagged as a possible duplicate", () => {
    const online = gift({ donorEmail: "same@example.com" });
    const off = gift({ provider: "offline", donorEmail: "same@example.com" });
    expect(evaluateSignals(off, [online, off], teams).signals).toContain("offline_possible_duplicate");
  });
});

describe("leaderboard", () => {
  const c = { ...defaultCampaign, leaderboardBasis: "money" as const, selfDonation: "count" as const };

  it("ranks by the chosen basis and computes all three measures", () => {
    const ds = [gift({ teamId: "A", amountCents: 20000, campaignAmountCents: 20000 }), gift({ teamId: "B" }), gift({ teamId: "B" }), gift({ teamId: "B" })];
    expect(rankTeams(ds, teams, c)[0].teamId).toBe("A");
    expect(rankTeams(ds, teams, { ...c, leaderboardBasis: "gifts" })[0].teamId).toBe("B");
    const row = rankTeams(ds, teams, { ...c, leaderboardBasis: "donors" })[0];
    expect(row.teamId).toBe("B");
    expect([row.gifts, row.donors]).toEqual([3, 3]);
  });

  it("distinct-donor basis counts one person once, and a manual merge is honored", () => {
    const ds = [gift({ teamId: "A", donorId: "d_same" }), gift({ teamId: "A", donorId: "d_same" }), gift({ teamId: "A", donorId: "d_other" })];
    expect(rankTeams(ds, teams, c).find((r) => r.teamId === "A")!.donors).toBe(2);
  });

  it("refunded, pending, failed and set-aside gifts do not count", () => {
    const ds = [
      gift({ teamId: "A" }), gift({ teamId: "A", status: "pending" }), gift({ teamId: "A", status: "failed" }),
      gift({ teamId: "A", status: "refunded", refundedCents: 3600 }), gift({ teamId: "A", reviewState: "excluded" }),
    ];
    const a = rankTeams(ds, teams, c).find((r) => r.teamId === "A")!;
    expect([a.cashCents, a.gifts]).toEqual([3600, 1]);
  });

  it("a cleared review restores a gift to the ranking", () => {
    const g = gift({ teamId: "A", reviewState: "excluded" });
    expect(rankTeams([g], teams, c).find((r) => r.teamId === "A")!.gifts).toBe(0);
    expect(rankTeams([{ ...g, reviewState: "cleared" }], teams, c).find((r) => r.teamId === "A")!.gifts).toBe(1);
  });

  it("self-donation policy excludes the owner's own gift only when the charity says so", () => {
    const own = gift({ teamId: "A", donorEmail: "a@example.com" });
    expect(rankTeams([own], teams, c).find((r) => r.teamId === "A")!.gifts).toBe(1);
    expect(rankTeams([own], teams, { ...c, selfDonation: "exclude" }).find((r) => r.teamId === "A")!.gifts).toBe(0);
  });

  it("partial refunds shrink a team's total", () => {
    const g = gift({ teamId: "A", refundedCents: 1800 });
    expect(rankTeams([g], teams, c).find((r) => r.teamId === "A")!.cashCents).toBe(1800);
  });

  it("publishes the rule it applies", () => {
    const text = rulesText({ ...c, leaderboardBasis: "donors", selfDonation: "exclude", cutoffAt: "2026-12-01T00:00:00Z" });
    expect(text).toMatch(/different donors/);
    expect(text).toMatch(/own gift .* does not count/);
    expect(text).toMatch(/provisional until/);
  });
});
