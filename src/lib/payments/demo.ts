import type { PaymentProviderImpl } from "./types";

/** No money, no card fields. The browser shows a "Simulate payment" button that hits /api/demo/confirm. */
export const demoProvider: PaymentProviderImpl = {
  async createSession(_c, d) {
    return { provider: "demo", paymentRef: `demo_${d.id}` };
  },
};
