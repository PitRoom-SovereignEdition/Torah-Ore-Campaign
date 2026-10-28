import { z } from "zod";
import { invalidateTotals } from "@/lib/donations";
import { handleError, json, readJson, requireAdminApi } from "@/lib/http";
import { newId, nowIso } from "@/lib/ids";
import { convertCents } from "@/lib/money";
import { getStore } from "@/lib/store";

const schema = z.object({
  donorName: z.string().trim().min(1).max(120),
  donorEmail: z.string().trim().max(200).default(""),
  amount: z.number().positive(),
  currency: z.string().length(3),
  teamId: z.string().max(64).nullish(),
  anonymous: z.boolean().default(false),
  showOnWall: z.boolean().default(true),
  message: z.string().trim().max(300).default(""),
  dedication: z.string().trim().max(200).default(""),
  reference: z.string().trim().max(120).default(""),
});

/** Cheques, cash, DAF / voucher payments received outside the card flow. Admin-entered only. */
export async function POST(req: Request) {
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  try {
    const i = schema.parse(await readJson(req));
    const store = getStore();
    const c = await store.getCampaign();
    const cur = i.currency.toUpperCase();
    const rate = cur === c.currency ? 1 : c.fxRates[cur];
    if (!rate) return json({ error: "Currency not configured for this campaign." }, 400);
    if (i.teamId && !(await store.getTeam(i.teamId))) return json({ error: "Unknown team" }, 400);
    const cents = Math.round(i.amount * 100);
    const ts = nowIso();
    await store.createDonation({
      id: newId(),
      campaignId: c.id,
      teamId: i.teamId ?? null,
      amountCents: cents,
      currency: cur,
      campaignAmountCents: convertCents(cents, rate),
      fxRate: rate,
      refundedCents: 0,
      displayName: i.anonymous ? "Anonymous" : i.donorName,
      anonymous: i.anonymous,
      showOnWall: i.showOnWall,
      message: i.message,
      dedication: i.dedication,
      donorName: i.donorName,
      donorEmail: i.donorEmail,
      reference: i.reference,
      address: "",
      city: "",
      state: "",
      zip: "",
      country: "",
      provider: "offline",
      paymentRef: `offline_${newId()}`,
      status: "succeeded",
      isDemo: false,
      createdAt: ts,
      updatedAt: ts,
    });
    invalidateTotals();
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
