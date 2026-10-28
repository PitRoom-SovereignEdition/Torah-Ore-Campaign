import type { Campaign, Donation } from "../types";

export interface PaymentSession {
  provider: "stripe" | "demo";
  paymentRef: string;
  /** Stripe only: client secret for the embedded Payment Element. */
  clientSecret?: string;
}

export interface PaymentProviderImpl {
  /** Create the charge intent. Amount/currency come from the server-priced Donation, never from the client. */
  createSession(campaign: Campaign, donation: Donation): Promise<PaymentSession>;
}
