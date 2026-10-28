import { describe, expect, it } from "vitest";
import { computeTotals, effectiveCents } from "@/lib/matching";
import type { Donation, Matcher } from "@/lib/types";

const base: Donation = {
  id: "x", campaignId: "main", teamId: null, amountCents: 10000, currency: "USD", campaignAmountCents: 10000, fxRate: 1, refundedCents: 0,
  displayName: "A", anonymous: false, showOnWall: true, message: "", dedication: "", donorName: "A", donorEmail: "a@b.c", reference: "",
  address: "", city: "", state: "", zip: "", country: "", provider: "stripe", paymentRef: null, status: "succeeded", isDemo: false,
  createdAt: "2026-01-02T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
};
const d = (id: string, over: Partial<Donation> = {}): Donation => ({ ...base, id, paymentRef: id, ...over });
const m = (over: Partial<Matcher> = {}): Matcher => ({
  id: "m1", campaignId: "main", name: "M", multiplier: 1, capCents: 25000, currency: "USD",
  windowStart: "2026-01-01T00:00:00.000Z", windowEnd: "2026-01-31T00:00:00.000Z", ...over,
});

describe("totals", () => {
  it("counts only succeeded cash and keeps matched separate", () => {
    const t = computeTotals([d("1"), d("2", { status: "pending" }), d("3", { status: "failed" }), d("4", { status: "flagged" })], [], "USD");
    expect(t.cashCents).toBe(10000);
    expect(t.matchedCents).toBe(0);
    expect(t.donorCount).toBe(1);
  });

  it("matches 1:1 until the cap, then stops", () => {
    const ds = [d("1", { createdAt: "2026-01-02T00:00:00.000Z" }), d("2", { createdAt: "2026-01-03T00:00:00.000Z" }), d("3", { createdAt: "2026-01-04T00:00:00.000Z" })];
    const t = computeTotals(ds, [m({ capCents: 25000 })], "USD");
    expect(t.cashCents).toBe(30000);
    expect(t.matchedCents).toBe(25000); // 10000 + 10000 + 5000 (capped)
    expect(t.matchers[0].remainingCents).toBe(0);
  });

  it("applies multiplier", () => {
    const t = computeTotals([d("1")], [m({ multiplier: 2 })], "USD");
    expect(t.matchedCents).toBe(20000);
  });

  it("ignores gifts outside the window and other currencies", () => {
    const t = computeTotals([d("1", { createdAt: "2025-12-31T00:00:00.000Z" })], [m()], "USD");
    expect(t.matchedCents).toBe(0);
    expect(computeTotals([d("1")], [m({ currency: "GBP" })], "USD").matchedCents).toBe(0);
  });

  it("a refund removes cash and frees matcher cap", () => {
    const refunded = d("1", { status: "refunded", refundedCents: 10000 });
    const t = computeTotals([refunded, d("2", { createdAt: "2026-01-05T00:00:00.000Z" })], [m({ capCents: 10000 })], "USD");
    expect(t.cashCents).toBe(10000);
    expect(t.matchedCents).toBe(10000); // cap went to the surviving gift
  });

  it("partial refunds shrink the contribution proportionally", () => {
    expect(effectiveCents(d("1", { refundedCents: 2500 }))).toBe(7500);
  });

  it("attributes cash to teams", () => {
    const t = computeTotals([d("1", { teamId: "t1" }), d("2", { teamId: "t1" }), d("3")], [], "USD");
    expect(t.teamTotals.t1).toEqual({ cashCents: 20000, count: 2 });
  });
});
