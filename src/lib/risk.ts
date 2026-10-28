import type { Donation, Team } from "./types";

/**
 * Review signals. Every signal here is a REASON TO LOOK, never proof of anything: families, roommates,
 * a dorm, a shared office or one Wi-Fi network all produce legitimate repeats. Signals open a review for
 * a human; only an authorized reviewer can exclude a gift from the leaderboard, with a logged reason.
 * "medium" signals open a review alone; "weak" ones need a second signal.
 */
export const SIGNALS = {
  card_multi_team: { severity: "medium", label: "Same card used on 3+ different teams" },
  card_many_gifts: { severity: "medium", label: "Same card used 5+ times in 24h" },
  circular_giving: { severity: "medium", label: "Circular giving between two team owners" },
  success_after_failures: { severity: "medium", label: "Success right after a burst of failed payments" },
  dispute_open: { severity: "medium", label: "Card dispute opened" },
  burst_identical: { severity: "weak", label: "5+ identical gifts to one team within 10 minutes" },
  same_ip_many: { severity: "weak", label: "8+ gifts from one network to one team within an hour (shared networks are normal)" },
  same_address_many: { severity: "weak", label: "4+ gifts from one address to one team within 24h" },
  self_gift: { severity: "weak", label: "Team owner's own gift to their own page" },
  cvc_failed: { severity: "weak", label: "Card security code check failed" },
  postal_failed: { severity: "weak", label: "Postal code check failed" },
  prepaid_card: { severity: "weak", label: "Prepaid card" },
  offline_possible_duplicate: { severity: "weak", label: "Offline gift matches a recent online gift (same email and amount)" },
} as const;
export type SignalCode = keyof typeof SIGNALS;

export const norm = (s: string) => s.trim().toLowerCase();
const HOUR = 3600_000;
const ts = (d: Donation) => Date.parse(d.createdAt);

export function evaluateSignals(d: Donation, all: Donation[], teams: Team[]): { signals: SignalCode[]; open: boolean } {
  const out = new Set<SignalCode>();
  const ok = (x: Donation) => x.status === "succeeded" || x.status === "flagged";
  const t0 = ts(d);
  const team = d.teamId ? teams.find((t) => t.id === d.teamId) : undefined;
  const email = norm(d.donorEmail);

  if (d.cardFingerprint) {
    const same = all.filter((x) => x.cardFingerprint === d.cardFingerprint && ok(x));
    if (new Set(same.map((x) => x.teamId).filter(Boolean)).size >= 3) out.add("card_multi_team");
    if (same.filter((x) => Math.abs(ts(x) - t0) <= 24 * HOUR).length >= 5) out.add("card_many_gifts");
  }
  if (d.cardChecks?.cvc === "fail") out.add("cvc_failed");
  if (d.cardChecks?.postal === "fail") out.add("postal_failed");
  if (d.cardFunding === "prepaid") out.add("prepaid_card");
  if (d.disputeState === "open") out.add("dispute_open");

  if (d.teamId) {
    const sameTeam = all.filter((x) => x.teamId === d.teamId && ok(x));
    if (sameTeam.filter((x) => x.campaignAmountCents === d.campaignAmountCents && Math.abs(ts(x) - t0) <= 10 * 60_000).length >= 5) out.add("burst_identical");
    if (d.ipHash && sameTeam.filter((x) => x.ipHash === d.ipHash && Math.abs(ts(x) - t0) <= HOUR).length >= 8) out.add("same_ip_many");
    const addr = norm(`${d.address}|${d.zip}`);
    if (d.address && sameTeam.filter((x) => norm(`${x.address}|${x.zip}`) === addr && Math.abs(ts(x) - t0) <= 24 * HOUR).length >= 4) out.add("same_address_many");
    if (team && email && norm(team.ownerEmail) === email) out.add("self_gift");

    // Circular: this donor owns team X (X != this team), and this team's owner gave to X.
    if (team && email) {
      const ownedByDonor = teams.filter((t) => norm(t.ownerEmail) === email && t.id !== team.id).map((t) => t.id);
      const ownerEmail = norm(team.ownerEmail);
      if (ownedByDonor.length && all.some((x) => ok(x) && x.teamId && ownedByDonor.includes(x.teamId) && norm(x.donorEmail) === ownerEmail)) out.add("circular_giving");
    }
  }

  if (d.ipHash) {
    const failed = all.filter((x) => x.status === "failed" && x.ipHash === d.ipHash && t0 - ts(x) >= 0 && t0 - ts(x) <= 30 * 60_000);
    if (failed.length >= 5) out.add("success_after_failures");
  }

  if (d.provider === "offline" && email) {
    const dup = all.some((x) => x.provider !== "offline" && ok(x) && norm(x.donorEmail) === email && x.campaignAmountCents === d.campaignAmountCents && Math.abs(ts(x) - t0) <= 14 * 24 * HOUR);
    if (dup) out.add("offline_possible_duplicate");
  }

  const list = [...out];
  const medium = list.some((c) => SIGNALS[c].severity === "medium");
  const weak = list.filter((c) => SIGNALS[c].severity === "weak").length;
  return { signals: list, open: medium || weak >= 2 };
}
