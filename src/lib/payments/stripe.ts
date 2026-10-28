import Stripe from "stripe";
import type { PaymentProviderImpl } from "./types";

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key);
  }
  return client;
}

export const stripeProvider: PaymentProviderImpl = {
  async createSession(campaign, d) {
    const suffix = campaign.statementDescriptor.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 22) || undefined;
    const intent = await stripe().paymentIntents.create(
      {
        amount: d.amountCents,
        currency: d.currency.toLowerCase(),
        // Cards, Apple Pay, Google Pay, etc. as enabled in the Stripe dashboard.
        automatic_payment_methods: { enabled: true },
        statement_descriptor_suffix: suffix,
        description: `${campaign.title} (donation ${d.id})`,
        metadata: { donationId: d.id, campaignId: d.campaignId, teamId: d.teamId ?? "" },
      },
      // Retrying the same donation can never create a second intent.
      { idempotencyKey: `donation_${d.id}` },
    );
    return { provider: "stripe", paymentRef: intent.id, clientSecret: intent.client_secret ?? undefined };
  },
};
