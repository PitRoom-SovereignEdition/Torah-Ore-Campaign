import { z } from "zod";
import { handleError, json, readJson, requireAdminApi } from "@/lib/http";
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
});

export async function POST(req: Request) {
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  try {
    const i = schema.parse(await readJson(req));
    const { goal, bonusGoal, ...rest } = i;
    const c = await getStore().saveCampaign({
      ...rest,
      goalCents: Math.round(goal * 100),
      bonusGoalCents: bonusGoal ? Math.round(bonusGoal * 100) : null,
    });
    return json({ ok: true, campaign: c });
  } catch (e) {
    return handleError(e);
  }
}
