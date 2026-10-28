import { json } from "@/lib/http";
import { getStore } from "@/lib/store";

/** Status only: the thank-you page polls this. Donation ids are unguessable UUIDs. */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const d = await getStore().getDonation(id);
  if (!d) return json({ error: "Not found" }, 404);
  return json({ status: d.status, amountCents: d.amountCents, currency: d.currency, isDemo: d.isDemo });
}
