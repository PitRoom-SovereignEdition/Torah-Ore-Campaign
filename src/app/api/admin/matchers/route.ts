import { z } from "zod";
import { invalidateTotals } from "@/lib/donations";
import { handleError, json, readJson, requireAdminApi } from "@/lib/http";
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
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  try {
    const i = schema.parse(await readJson(req));
    if (i.windowEnd <= i.windowStart) return json({ error: "Window end must be after start." }, 400);
    const store = getStore();
    const c = await store.getCampaign();
    await store.createMatcher({
      id: newId().slice(0, 8),
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
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  const { id } = await readJson<{ id?: string }>(req);
  if (!id) return json({ error: "Missing id" }, 400);
  await getStore().deleteMatcher(id);
  invalidateTotals();
  return json({ ok: true });
}
