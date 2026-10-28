import { getTotals } from "@/lib/donations";
import { handleError, json } from "@/lib/http";
import { getStore } from "@/lib/store";

export async function GET(req: Request) {
  try {
    const team = new URL(req.url).searchParams.get("team");
    const c = await getStore().getCampaign();
    const t = await getTotals(c);
    const scoped = team ? (t.teamTotals[team] ?? { cashCents: 0, count: 0 }) : null;
    return json({
      cashCents: scoped ? scoped.cashCents : t.cashCents,
      matchedCents: scoped ? 0 : t.matchedCents,
      donorCount: scoped ? scoped.count : t.donorCount,
    });
  } catch (e) {
    return handleError(e);
  }
}
