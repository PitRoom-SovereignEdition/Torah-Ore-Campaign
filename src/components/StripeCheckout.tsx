"use client";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useMemo, useState } from "react";
import type { Dict } from "@/lib/i18n";

/**
 * Card data is typed into Stripe's own iframe (PaymentElement). It never touches our server or
 * even our DOM. After confirmPayment, Stripe redirects to /thanks, which only *reads* the
 * donation status; the donation becomes "succeeded" via the signed webhook, not this redirect.
 */
export function StripeCheckout({ t, publishableKey, clientSecret, donationId, payLabel }: { t: Dict; publishableKey: string; clientSecret: string; donationId: string; payLabel: string }) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
      <Inner t={t} donationId={donationId} payLabel={payLabel} />
    </Elements>
  );
}

function Inner({ t, donationId, payLabel }: { t: Dict; donationId: string; payLabel: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setErr("");
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${location.origin}/thanks?d=${donationId}` },
    });
    // Only reached on immediate errors; on success the browser is redirected.
    if (error) setErr(error.message ?? "Payment failed");
    setBusy(false);
  };

  return (
    <form onSubmit={pay} className="stack">
      <PaymentElement />
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn block" disabled={!stripe || busy}>{busy ? t.processing : payLabel}</button>
    </form>
  );
}
