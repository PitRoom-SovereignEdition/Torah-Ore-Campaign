import { z } from "zod";
import { audit } from "@/lib/audit";
import { invalidateTotals } from "@/lib/donations";
import { handleError, json, readJson, requireRole } from "@/lib/http";
import { sha256 } from "@/lib/ids";
import { getStore } from "@/lib/store";

const schema = z.object({
  id: z.string().min(1),
  action: z.enum(["clear", "exclude", "restore", "merge", "split"]),
  reason: z.string().trim().min(3, "Give a reason (3+ characters).").max(500),
  /** merge: the donor id to adopt (copy it from another gift). */
  donorId: z.string().trim().max(64).optional(),
});

/**
 * Review decisions. Organizer only, and every decision needs a written reason that goes into the
 * append-only audit log. "exclude" sets a gift aside from the LEADERBOARD only (the money is still real
 * and still counts in the campaign total); "restore"/"clear" undo it. Fundraisers never see any of this.
 */
export async function POST(req: Request) {
  const auth = await requireRole(req, ["organizer"]);
  if ("denied" in auth) return auth.denied;
  try {
    const { id, action, reason, donorId } = schema.parse(await readJson(req));
    const store = getStore();
    const d = await store.getDonation(id);
    if (!d) return json({ error: "Unknown donation" }, 404);

    if (action === "clear" || action === "restore") {
      await store.updateDonation(id, { reviewState: "cleared" });
    } else if (action === "exclude") {
      await store.updateDonation(id, { reviewState: "excluded" });
    } else if (action === "merge") {
      if (!donorId?.startsWith("d_")) return json({ error: "Enter the donor id to merge into (starts with d_)." }, 400);
      await store.updateDonation(id, { donorId });
    } else {
      await store.updateDonation(id, { donorId: "d_" + sha256(`split:${id}`).slice(0, 16) });
    }
    await audit(auth.role, `review.${action}`, "donation", id, { reason, from: { reviewState: d.reviewState, donorId: d.donorId }, signals: d.signals, donorId });
    invalidateTotals();
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
