import { paymentsMode, stripeKeyKind } from "../config";
import { demoProvider } from "./demo";
import { stripeProvider } from "./stripe";
import type { PaymentProviderImpl } from "./types";

export function getProvider(): PaymentProviderImpl | null {
  const mode = paymentsMode();
  if (mode === "demo") return demoProvider;
  if (mode === "stripe") {
    if (stripeKeyKind() === "missing" || !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) return null;
    return stripeProvider;
  }
  return null;
}
export type { PaymentSession } from "./types";
