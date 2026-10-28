import { z } from "zod";
import { audit } from "@/lib/audit";
import { handleError, json, readJson, requireRole } from "@/lib/http";
import { isSupportedCurrency } from "@/lib/money";
import { getStore } from "@/lib/store";

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(200),
  description: z.string().trim().max(600),
  longDescription: z.string().trim().max(6000),
  goal: z.number().positive(),
  bonusGoal: z.number().positive().nullable(),
  currency: z.string().refine(isSupportedCurrency),
  fxRates: z.record(z.string().refine(isSupportedCurrency), z.number().positive().max(1000)),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  videoUrl: z.string().trim().url().nullable().or(z.literal("").transform(() => null)),
  charityName: z.string().trim().max(200),
  charityRegNo: z.string().trim().max(100),
  statementDescriptor: z.string().trim().max(22),
  receiptFooter: z.string().trim().max(2000),
  termsUrl: z.string().trim().max(500),
  contactEmail: z.string().trim().max(200),
  leaderboardBasis: z.enum(["money", "gifts", "donors"]),
  selfDonation: z.enum(["count", "exclude"]),
  cutoffAt: z.string().nullable(),
  leaderboardRules: z.string().trim().max(3000),
});

export async function POST(req: Request) {
  const auth = await requireRole(req, ["organizer"]);
  if ("denied" in auth) return auth.denied;
  try {
    const i = schema.parse(await readJson(req));
    const { goal, bonusGoal, ...rest } = i;
    const store = getStore();
    const before = await store.getCampaign();
    const c = await store.saveCampaign({
      ...rest,
      goalCents: Math.round(goal * 100),
      bonusGoalCents: bonusGoal ? Math.round(bonusGoal * 100) : null,
    });
    const changed = Object.keys(c).filter((k) => JSON.stringify((c as unknown as Record<string, unknown>)[k]) !== JSON.stringify((before as unknown as Record<string, unknown>)[k]));
    await audit(auth.role, "campaign.update", "campaign", c.id, {
      changed,
      goalFrom: before.goalCents, goalTo: c.goalCents,
      basisFrom: before.leaderboardBasis, basisTo: c.leaderboardBasis,
      selfDonationFrom: before.selfDonation, selfDonationTo: c.selfDonation,
    });
    return json({ ok: true, campaign: c });
  } catch (e) {
    return handleError(e);
  }
}
