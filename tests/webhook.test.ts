import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Stripe from "stripe";
import { describe, expect, it } from "vitest";

process.env.JSON_STORE_PATH = path.join(mkdtempSync(path.join(tmpdir(), "yc-wh-")), "db.json");
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_testsecret";
process.env.PAYMENTS_MODE = "stripe";

const { POST } = await import("@/app/api/webhooks/stripe/route");
const { buildPendingDonation, donateSchema } = await import("@/lib/donations");
const { getStore } = await import("@/lib/store");
const { defaultCampaign } = await import("@/lib/config");

const stripe = new Stripe("sk_test_dummy");

function signed(event: object, secret = "whsec_testsecret") {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request("http://x/api/webhooks/stripe", { method: "POST", body: payload, headers: { "stripe-signature": header } });
}
const pi = (id: string, amount: number, eventId: string, type = "payment_intent.succeeded") => ({
  id: eventId, object: "event", type, data: { object: { id, object: "payment_intent", amount, amount_received: amount, currency: "usd" } },
});

async function seed(ref: string) {
  const d = await buildPendingDonation(defaultCampaign, donateSchema.parse({
    amount: 50, currency: "USD", donorName: "W", donorEmail: "w@example.com", address: "a", city: "c", country: "US", acceptTerms: true,
  }));
  await getStore().createDonation({ ...d, paymentRef: ref });
  return d.id;
}

describe("stripe webhook route", () => {
  it("rejects bad signatures", async () => {
    const id = await seed("pi_bad");
    const res = await POST(signed(pi("pi_bad", 5000, "evt_bad"), "whsec_wrong"));
    expect(res.status).toBe(400);
    expect((await getStore().getDonation(id))!.status).toBe("pending");
  });

  it("confirms on a valid signed event and ignores replays", async () => {
    const id = await seed("pi_ok");
    expect((await POST(signed(pi("pi_ok", 5000, "evt_ok")))).status).toBe(200);
    expect((await getStore().getDonation(id))!.status).toBe("succeeded");
    const replay = await (await POST(signed(pi("pi_ok", 5000, "evt_ok")))).json();
    expect(replay.duplicate).toBe(true);
  });

  it("flags tampered amounts instead of counting them", async () => {
    const id = await seed("pi_amt");
    await POST(signed(pi("pi_amt", 100, "evt_amt")));
    expect((await getStore().getDonation(id))!.status).toBe("flagged");
  });

  it("applies refunds from charge.refunded", async () => {
    const id = await seed("pi_ref");
    await POST(signed(pi("pi_ref", 5000, "evt_r1")));
    await POST(signed({ id: "evt_r2", object: "event", type: "charge.refunded", data: { object: { id: "ch_1", object: "charge", payment_intent: "pi_ref", amount_refunded: 5000 } } }));
    const d = (await getStore().getDonation(id))!;
    expect([d.status, d.refundedCents]).toEqual(["refunded", 5000]);
  });
});
