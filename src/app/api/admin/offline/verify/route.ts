import { z } from "zod";
import { audit } from "@/lib/audit";
import { assessDonation, invalidateTotals } from "@/lib/donations";
import { handleError, json, readJson, requireRole } from "@/lib/http";
import { getStore } from "@/lib/store";

const schema = z.object({ id: z.string().min(1), action: z.enum(["verify", "reject"]), reason: z.string().trim().max(500).default("") });

/** Second-person verification of an offline gift. The verifier must be a different role than the enterer. */
export async function POST(req: Request) {
  const auth = await requireRole(req, ["organizer", "finance"]);
  if ("denied" in auth) return auth.denied;
  try {
    const { id, action, reason } = schema.parse(await readJson(req));
    const store = getStore();
    const d = await store.getDonation(id);
    if (!d || d.provider !== "offline" || d.status !== "pending") return json({ error: "No offline gift is waiting for verification." }, 400);
    if (d.enteredBy === auth.role) return json({ error: "A second person must verify this: it was entered by your role." }, 403);
    if (action === "reject") {
      if (reason.length < 3) return json({ error: "Give a reason." }, 400);
      await store.updateDonation(id, { status: "failed", verifiedBy: auth.role });
      await audit(auth.role, "offline.rejected", "donation", id, { reason });
      return json({ ok: true });
    }
    await store.updateDonation(id, { status: "succeeded", verifiedBy: auth.role });
    await audit(auth.role, "offline.verified", "donation", id, { enteredBy: d.enteredBy, amountCents: d.amountCents });
    invalidateTotals();
    await assessDonation(id);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
