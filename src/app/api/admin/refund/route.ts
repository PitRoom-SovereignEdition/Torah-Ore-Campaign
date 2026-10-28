import { paymentsMode } from "@/lib/config";
import { audit } from "@/lib/audit";
import { applyPaymentEvent, invalidateTotals } from "@/lib/donations";
import { handleError, json, readJson, requireRole } from "@/lib/http";
import { stripe } from "@/lib/payments/stripe";
import { getStore } from "@/lib/store";

/** Full refund. Stripe cards: asks Stripe (the webhook then confirms). Demo/offline: records it directly. */
export async function POST(req: Request) {
  const auth = await requireRole(req, ["organizer", "finance"]);
  if ("denied" in auth) return auth.denied;
  try {
    const { id } = await readJson<{ id?: string }>(req);
    const store = getStore();
    const d = id ? await store.getDonation(id) : null;
    if (!d || d.status !== "succeeded") return json({ error: "Only succeeded donations can be refunded." }, 400);
    await audit(auth.role, "refund.requested", "donation", d.id, { amountCents: d.amountCents, currency: d.currency, provider: d.provider });

    if (d.provider === "stripe") {
      if (paymentsMode() !== "stripe" || !d.paymentRef) return json({ error: "Stripe is not active." }, 400);
      await stripe().refunds.create({ payment_intent: d.paymentRef }, { idempotencyKey: `refund_${d.id}` });
      return json({ ok: true, note: "Refund requested. It will show as refunded once Stripe confirms." });
    }
    await applyPaymentEvent({ type: "refunded", paymentRef: d.paymentRef!, refundedCents: d.amountCents });
    invalidateTotals();
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
