import type Stripe from "stripe";
import { audit } from "@/lib/audit";
import { applyPaymentEvent, assessDonation, invalidateTotals } from "@/lib/donations";
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
        if (r.changed && r.donation?.status === "succeeded") {
          await assessDonation(r.donation.id);
          await sendConfirmation(await store.getCampaign(), r.donation);
        }
        break;
      }
      case "charge.succeeded": {
        // Card details for review signals (fingerprint, CVC/postal checks, funding). May arrive before or after
        // payment_intent.succeeded; whichever comes last runs the assessment with the full picture.
        const ch = event.data.object as Stripe.Charge;
        const ref = typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id;
        const card = ch.payment_method_details?.card;
        if (ref && card) {
          const r = await applyPaymentEvent({
            type: "card", paymentRef: ref, fingerprint: card.fingerprint ?? null,
            checks: { cvc: card.checks?.cvc_check ?? null, postal: card.checks?.address_postal_code_check ?? null, line1: card.checks?.address_line1_check ?? null },
            funding: card.funding ?? null, country: card.country ?? null,
          });
          if (r.donation) await assessDonation(r.donation.id);
        }
        break;
      }
      case "charge.dispute.created":
      case "charge.dispute.closed": {
        const dp = event.data.object as Stripe.Dispute;
        const ref = typeof dp.payment_intent === "string" ? dp.payment_intent : dp.payment_intent?.id;
        if (ref) {
          const state = event.type === "charge.dispute.created" ? "open" : dp.status === "won" ? "won" : dp.status === "lost" ? "lost" : null;
          if (state) {
            const r = await applyPaymentEvent({ type: "dispute", paymentRef: ref, state });
            if (r.donation) {
              await audit("system", `dispute.${state}`, "donation", r.donation.id, { reason: dp.reason, amount: dp.amount });
              if (state === "open") await assessDonation(r.donation.id);
            }
          }
        }
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
        if (ref) {
          const r = await applyPaymentEvent({ type: "refunded", paymentRef: ref, refundedCents: ch.amount_refunded });
          if (r.changed && r.donation) await audit("system", "refund.confirmed", "donation", r.donation.id, { refundedCents: ch.amount_refunded });
        }
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
