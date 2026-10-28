import { paymentsMode } from "@/lib/config";
import { applyPaymentEvent, invalidateTotals } from "@/lib/donations";
import { handleError, json, readJson } from "@/lib/http";
import { sendConfirmation } from "@/lib/mailer";
import { getStore } from "@/lib/store";

/** Demo mode only: stands in for the processor webhook. Hard-disabled in any other mode. */
export async function POST(req: Request) {
  try {
    if (paymentsMode() !== "demo") return json({ error: "Not available" }, 404);
    const { donationId } = await readJson<{ donationId?: string }>(req);
    const store = getStore();
    const d = donationId ? await store.getDonation(donationId) : null;
    if (!d || !d.isDemo || !d.paymentRef) return json({ error: "Unknown donation" }, 404);
    const r = await applyPaymentEvent({ type: "succeeded", paymentRef: d.paymentRef, amountCents: d.amountCents, currency: d.currency });
    if (r.changed && r.donation) {
      invalidateTotals();
      await sendConfirmation(await store.getCampaign(), r.donation);
    }
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
