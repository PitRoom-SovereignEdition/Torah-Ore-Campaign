import { z } from "zod";
import { audit } from "@/lib/audit";
import { donorIdFor, riskDefaults } from "@/lib/donations";
import { handleError, json, readJson, requireRole } from "@/lib/http";
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

/**
 * Cheques, cash, DAF / voucher payments received outside the card flow. An offline gift is entered as
 * PENDING and counts only after a DIFFERENT signed-in person (the other role) verifies it, so no single
 * person can add money to the totals alone.
 */
export async function POST(req: Request) {
  const auth = await requireRole(req, ["organizer", "finance"]);
  if ("denied" in auth) return auth.denied;
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
    const id = newId();
    await store.createDonation({
      id,
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
      donorId: donorIdFor(i.donorEmail || `${i.donorName}|${id}`),
      ipHash: "",
      ...riskDefaults(),
      enteredBy: auth.role,
      provider: "offline",
      paymentRef: `offline_${newId()}`,
      status: "pending",
      isDemo: false,
      createdAt: ts,
      updatedAt: ts,
    });
    await audit(auth.role, "offline.entered", "donation", id, { amountCents: cents, currency: cur, reference: i.reference });
    return json({ ok: true, note: "Recorded as pending. A second person must verify it before it counts." });
  } catch (e) {
    return handleError(e);
  }
}
