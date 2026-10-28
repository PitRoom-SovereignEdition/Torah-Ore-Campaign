import type { Donation, Matcher, MatcherProgress, Totals } from "./types";

/** Cash a donation contributes to the campaign, net of partial refunds. */
export function effectiveCents(d: Donation): number {
  if (d.status !== "succeeded") return 0;
  if (d.amountCents <= 0) return 0;
  const keep = Math.max(0, d.amountCents - d.refundedCents) / d.amountCents;
  return Math.round(d.campaignAmountCents * keep);
}

export function countsAsDonor(d: Donation): boolean {
  return d.status === "succeeded" && d.refundedCents < d.amountCents;
}

/**
 * Matching is computed deterministically from cash donations, never stored as fake donations.
 * Donations are walked in chronological order. A matcher only applies when:
 *   - same currency as the campaign (cross-currency matching is out of scope),
 *   - the donation was created inside the matcher's window,
 *   - the matcher still has cap remaining.
 * Matched amount = effective cash * multiplier, truncated to the remaining cap.
 * Because it's recomputed from succeeded donations, a refund automatically frees cap.
 */
export function computeTotals(
  donations: Donation[],
  matchers: Matcher[],
  campaignCurrency: string,
): Totals {
  const sorted = [...donations].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const matchedBy = new Map<string, number>(matchers.map((m) => [m.id, 0]));
  const teamTotals: Totals["teamTotals"] = {};
  let cash = 0;
  let donors = 0;

  for (const d of sorted) {
    const eff = effectiveCents(d);
    if (!eff) continue;
    cash += eff;
    if (countsAsDonor(d)) donors += 1;
    if (d.teamId) {
      const t = (teamTotals[d.teamId] ??= { cashCents: 0, count: 0 });
      t.cashCents += eff;
      t.count += 1;
    }
    let remaining = eff;
    for (const m of matchers) {
      if (remaining <= 0) break;
      if (m.currency !== campaignCurrency) continue;
      if (d.createdAt < m.windowStart || d.createdAt > m.windowEnd) continue;
      const used = matchedBy.get(m.id) ?? 0;
      const room = m.capCents - used;
      if (room <= 0) continue;
      const add = Math.min(Math.round(eff * m.multiplier), room);
      if (add <= 0) continue;
      matchedBy.set(m.id, used + add);
      // A single matcher "covers" the donation; later matchers apply only if cap ran out mid-donation.
      remaining -= Math.round(add / Math.max(m.multiplier, 1e-9));
    }
  }

  const progress: MatcherProgress[] = matchers.map((m) => {
    const matched = matchedBy.get(m.id) ?? 0;
    return { matcher: m, matchedCents: matched, remainingCents: Math.max(0, m.capCents - matched) };
  });
  const matchedCents = progress.reduce((s, p) => s + p.matchedCents, 0);
  return { cashCents: cash, matchedCents, donorCount: donors, teamTotals, matchers: progress };
}
