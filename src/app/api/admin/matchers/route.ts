import { z } from "zod";
import { invalidateTotals } from "@/lib/donations";
import { audit } from "@/lib/audit";
import { handleError, json, readJson, requireRole } from "@/lib/http";
import { newId } from "@/lib/ids";
import { getStore } from "@/lib/store";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  multiplier: z.number().positive().max(10),
  cap: z.number().positive(),
  windowStart: z.string().datetime({ offset: true }),
  windowEnd: z.string().datetime({ offset: true }),
});

export async function POST(req: Request) {
  const auth = await requireRole(req, ["organizer"]);
  if ("denied" in auth) return auth.denied;
  try {
    const i = schema.parse(await readJson(req));
    if (i.windowEnd <= i.windowStart) return json({ error: "Window end must be after start." }, 400);
    const store = getStore();
    const c = await store.getCampaign();
    const mid = newId().slice(0, 8);
    await audit(auth.role, "matcher.create", "matcher", mid, { name: i.name, multiplier: i.multiplier, capCents: Math.round(i.cap * 100), windowStart: i.windowStart, windowEnd: i.windowEnd });
    await store.createMatcher({
      id: mid,
      campaignId: c.id,
      name: i.name,
      multiplier: i.multiplier,
      capCents: Math.round(i.cap * 100),
      currency: c.currency, // matching is single-currency by design
      windowStart: i.windowStart,
      windowEnd: i.windowEnd,
    });
    invalidateTotals();
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: Request) {
  const auth = await requireRole(req, ["organizer"]);
  if ("denied" in auth) return auth.denied;
  const { id } = await readJson<{ id?: string }>(req);
  if (!id) return json({ error: "Missing id" }, 400);
  await audit(auth.role, "matcher.delete", "matcher", id);
  await getStore().deleteMatcher(id);
  invalidateTotals();
  return json({ ok: true });
}
