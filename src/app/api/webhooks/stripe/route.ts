import type Stripe from "stripe";
import { applyPaymentEvent, invalidateTotals } from "@/lib/donations";
import { json } from "@/lib/http";
import { sendConfirmation } from "@/lib/mailer";
import { stripe } from "@/lib/payments/stripe";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

/**
 * The single source of truth for "money arrived". Signature-verified against the raw body,
 * idempotent by event id, and amount-checked against what the server priced.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) return json({ error: "Webhook not configured" }, 400);

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, secret);
  } catch {
    return json({ error: "Invalid signature" }, 400);
  }

  const store = getStore();
  if (!(await store.recordEvent(event.id))) return json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const r = await applyPaymentEvent({ type: "succeeded", paymentRef: pi.id, amountCents: pi.amount_received || pi.amount, currency: pi.currency });
        if (r.changed && r.donation?.status === "succeeded") await sendConfirmation(await store.getCampaign(), r.donation);
        break;
      }
      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await applyPaymentEvent({ type: "failed", paymentRef: pi.id });
        break;
      }
      case "charge.refunded": {
        const ch = event.data.object as Stripe.Charge;
        const ref = typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id;
        if (ref) await applyPaymentEvent({ type: "refunded", paymentRef: ref, refundedCents: ch.amount_refunded });
        break;
      }
      default:
        break;
    }
    invalidateTotals();
    return json({ received: true });
  } catch (e) {
    // Let Stripe retry: forget the event so the retry is processed.
    console.error("[webhook] handler failed", e);
    await store.forgetEvent(event.id).catch(() => undefined);
    return json({ error: "Handler failed" }, 500);
  }
}
