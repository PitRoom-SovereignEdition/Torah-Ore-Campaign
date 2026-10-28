import { effectiveCents, countsAsDonor } from "./matching";
import { norm } from "./risk";
import { formatMoney } from "./money";
import type { Campaign, Donation, LeaderboardBasis, Team } from "./types";

export interface BoardRow {
  teamId: string;
  name: string;
  goalCents: number | null;
  cashCents: number;
  gifts: number;
  donors: number;
}

/**
 * Team ranking. A gift is eligible only if it is a confirmed gift (net of refunds) and it was not
 * excluded by an authorized reviewer, and, if the charity's policy says so, it is not the team
 * owner's own gift to their own page. The charity picks which number decides the ranking; all three
 * columns are always computed so the rule is visible and the boards can be compared.
 */
export function rankTeams(donations: Donation[], teams: Team[], c: Pick<Campaign, "leaderboardBasis" | "selfDonation">): BoardRow[] {
  const byTeam = new Map(teams.filter((t) => t.approved).map((t) => [t.id, t]));
  const rows = new Map<string, BoardRow & { ids: Set<string> }>();
  for (const t of byTeam.values()) rows.set(t.id, { teamId: t.id, name: t.name, goalCents: t.goalCents, cashCents: 0, gifts: 0, donors: 0, ids: new Set() });

  for (const d of donations) {
    if (!d.teamId || d.reviewState === "excluded") continue;
    const t = byTeam.get(d.teamId);
    const row = rows.get(d.teamId);
    if (!t || !row) continue;
    const cents = effectiveCents(d);
    if (!cents || !countsAsDonor(d)) continue;
    if (c.selfDonation === "exclude" && norm(d.donorEmail) === norm(t.ownerEmail)) continue;
    row.cashCents += cents;
    row.gifts += 1;
    row.ids.add(d.donorId || d.id);
  }

  const key: Record<LeaderboardBasis, (r: BoardRow) => number> = {
    money: (r) => r.cashCents,
    gifts: (r) => r.gifts,
    donors: (r) => r.donors,
  };
  const out = [...rows.values()].map(({ ids, ...r }) => ({ ...r, donors: ids.size }));
  const k = key[c.leaderboardBasis];
  // Ties broken by the other two measures, then name, so the order is stable and explainable.
  return out.sort((a, b) => k(b) - k(a) || b.cashCents - a.cashCents || b.donors - a.donors || a.name.localeCompare(b.name));
}

const BASIS_TEXT: Record<LeaderboardBasis, string> = {
  money: "Teams are ranked by the total amount raised.",
  gifts: "Teams are ranked by the number of gifts received.",
  donors: "Teams are ranked by the number of different donors.",
};

/** Published contest rules. The charity can override this text from the admin panel. */
export function rulesText(c: Campaign, locale = "en-US"): string {
  if (c.leaderboardRules.trim()) return c.leaderboardRules.trim();
  const cutoff = c.cutoffAt ? new Date(c.cutoffAt).toLocaleString(locale, { dateStyle: "long", timeStyle: "short" }) : null;
  return [
    BASIS_TEXT[c.leaderboardBasis],
    "Only confirmed gifts count, after refunds and reversals. Pending, failed and refunded gifts do not.",
    c.selfDonation === "exclude" ? "A fundraiser's own gift to their own page does not count toward their ranking." : "A fundraiser's own gift to their own page counts toward their ranking.",
    cutoff ? `Rankings are provisional until ${cutoff}. Refunds, disputes or a review can still change them afterward under these rules.` : "Rankings are provisional. Refunds, disputes or a review can change them.",
    "Gifts that look unusual are reviewed by organizers before the result is final. A reviewer may set a gift aside from the ranking with a recorded reason, and can restore it if the review clears it.",
  ].join(" ");
}

export const fmtBoard = (r: BoardRow, c: Campaign, locale: string) => formatMoney(r.cashCents, c.currency, locale, true);
