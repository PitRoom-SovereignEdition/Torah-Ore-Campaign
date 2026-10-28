import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.JSON_STORE_PATH = path.join(mkdtempSync(path.join(tmpdir(), "yc-admin-")), "db.json");
process.env.ADMIN_PASSWORD = "org-pass";
process.env.FINANCE_PASSWORD = "fin-pass";
process.env.ADMIN_SESSION_SECRET = "0123456789abcdef0123456789";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_testsecret";
process.env.PAYMENTS_MODE = "stripe";

let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "admin_session" && cookieValue ? { value: cookieValue } : undefined), set: () => {}, delete: () => {} }),
}));

const { makeSessionValue, roleForPassword } = await import("@/lib/auth");
const offline = await import("@/app/api/admin/offline/route");
const verify = await import("@/app/api/admin/offline/verify/route");
const review = await import("@/app/api/admin/review/route");
const exportCsv = await import("@/app/api/admin/export/route");
const webhook = await import("@/app/api/webhooks/stripe/route");
const { buildPendingDonation, donateSchema, getTotals } = await import("@/lib/donations");
const { getStore } = await import("@/lib/store");
const { defaultCampaign } = await import("@/lib/config");

const post = (handler: (r: Request) => Promise<Response>, body: unknown) =>
  handler(new Request("http://x/api", { method: "POST", headers: { "content-type": "application/json", host: "x" }, body: JSON.stringify(body) }));
const as = (role: "organizer" | "finance" | null) => { cookieValue = role ? makeSessionValue(role) : undefined; };

const stripe = new Stripe("sk_test_dummy");
const signed = (event: object) => {
  const payload = JSON.stringify(event);
  return new Request("http://x/api/webhooks/stripe", { method: "POST", body: payload, headers: { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_testsecret" }) } });
};

beforeEach(() => as(null));

describe("roles", () => {
  it("each password unlocks its own role only", () => {
    expect(roleForPassword("org-pass")).toBe("organizer");
    expect(roleForPassword("fin-pass")).toBe("finance");
    expect(roleForPassword("nope")).toBeNull();
  });
  it("admin APIs reject signed-out callers and the wrong role", async () => {
    expect((await post(review.POST, { id: "x", action: "clear", reason: "ok ok" })).status).toBe(401);
    as("finance");
    expect((await post(review.POST, { id: "x", action: "clear", reason: "ok ok" })).status).toBe(403);
  });
});

describe("offline gifts need a second person", () => {
  it("counts only after the OTHER role verifies, and logs it", async () => {
    as("organizer");
    expect((await post(offline.POST, { donorName: "Cheque Giver", donorEmail: "c@example.com", amount: 500, currency: "USD", reference: "chq 1" })).status).toBe(200);
    const store = getStore();
    const d = (await store.listDonations()).find((x) => x.donorName === "Cheque Giver")!;
    expect([d.status, d.enteredBy]).toEqual(["pending", "organizer"]);

    const c = await store.getCampaign();
    const before = (await getTotals(c, 0)).cashCents;
    expect((await post(verify.POST, { id: d.id, action: "verify" })).status).toBe(403); // same role cannot self-verify
    expect((await getTotals(c, 0)).cashCents).toBe(before);

    as("finance");
    expect((await post(verify.POST, { id: d.id, action: "verify" })).status).toBe(200);
    expect((await store.getDonation(d.id))!.status).toBe("succeeded");
    expect((await getTotals(c, 0)).cashCents).toBe(before + 50000);

    const actions = (await store.listAudit(50)).map((a) => `${a.actor}:${a.action}`);
    expect(actions).toEqual(expect.arrayContaining(["organizer:offline.entered", "finance:offline.verified"]));
  });
});

describe("review decisions", () => {
  it("require a reason, are organizer-only, change ranking eligibility and are logged", async () => {
    const store = getStore();
    const base = await buildPendingDonation(defaultCampaign, donateSchema.parse({ amount: 50, currency: "USD", donorName: "R", donorEmail: "r@example.com", address: "a", city: "c", country: "US", acceptTerms: true }));
    await store.createDonation({ ...base, status: "succeeded", paymentRef: "pi_rev", reviewState: "open", signals: ["card_multi_team"] });
    as("organizer");
    expect((await post(review.POST, { id: base.id, action: "exclude", reason: "" })).status).toBe(400);
    expect((await post(review.POST, { id: base.id, action: "exclude", reason: "same card on 3 teams, confirmed with donor" })).status).toBe(200);
    expect((await store.getDonation(base.id))!.reviewState).toBe("excluded");
    expect((await post(review.POST, { id: base.id, action: "restore", reason: "cleared after call" })).status).toBe(200);
    expect((await store.getDonation(base.id))!.reviewState).toBe("cleared");
    const log = (await store.listAudit(20)).filter((a) => a.targetId === base.id).map((a) => a.action);
    expect(log).toEqual(expect.arrayContaining(["review.exclude", "review.restore"]));
  });
});

describe("export is role-limited", () => {
  it("organizer export has no contact details; finance export does", async () => {
    as("organizer");
    const org = await (await exportCsv.GET()).text();
    expect(org).not.toContain("donor_email");
    expect(org).not.toContain("c@example.com");
    as("finance");
    const fin = await (await exportCsv.GET()).text();
    expect(fin).toContain("donor_email");
    expect(fin).toContain("c@example.com");
  });
});

describe("webhook: card checks and disputes", () => {
  async function seeded(ref: string, over: Record<string, unknown> = {}) {
    const d = await buildPendingDonation(defaultCampaign, donateSchema.parse({ amount: 50, currency: "USD", donorName: "W", donorEmail: "w@example.com", address: "a", city: "c", country: "US", acceptTerms: true, ...over }));
    await getStore().createDonation({ ...d, paymentRef: ref });
    return d.id;
  }
  const pi = (ref: string, evt: string) => ({ id: evt, object: "event", type: "payment_intent.succeeded", data: { object: { id: ref, object: "payment_intent", amount: 5000, amount_received: 5000, currency: "usd" } } });
  const charge = (ref: string, evt: string, card: object) => ({ id: evt, object: "event", type: "charge.succeeded", data: { object: { id: "ch_" + ref, object: "charge", payment_intent: ref, payment_method_details: { card } } } });

  it("stores card signals and opens a review from weak signals together, without excluding", async () => {
    const id = await seeded("pi_card");
    await webhook.POST(signed(charge("pi_card", "evt_c1", { fingerprint: "fp_z", funding: "prepaid", country: "US", checks: { cvc_check: "fail", address_postal_code_check: "pass" } })));
    await webhook.POST(signed(pi("pi_card", "evt_c2")));
    const d = (await getStore().getDonation(id))!;
    expect(d.cardFingerprint).toBe("fp_z");
    expect(d.signals).toEqual(expect.arrayContaining(["cvc_failed", "prepaid_card"]));
    expect(d.reviewState).toBe("open");
    expect(d.status).toBe("succeeded"); // still counted until a human decides
  });

  it("a lost dispute reverses the gift; a won dispute is recorded but nothing is auto-excluded", async () => {
    const lost = await seeded("pi_lost");
    await webhook.POST(signed(pi("pi_lost", "evt_l1")));
    await webhook.POST(signed({ id: "evt_l2", object: "event", type: "charge.dispute.closed", data: { object: { id: "dp_1", object: "dispute", payment_intent: "pi_lost", status: "lost", reason: "fraudulent", amount: 5000 } } }));
    const l = (await getStore().getDonation(lost))!;
    expect([l.status, l.disputeState, l.refundedCents]).toEqual(["refunded", "lost", 5000]);

    const won = await seeded("pi_won");
    await webhook.POST(signed(pi("pi_won", "evt_w1")));
    await webhook.POST(signed({ id: "evt_w2", object: "event", type: "charge.dispute.created", data: { object: { id: "dp_2", object: "dispute", payment_intent: "pi_won", status: "needs_response", reason: "general", amount: 5000 } } }));
    let w = (await getStore().getDonation(won))!;
    expect([w.status, w.disputeState, w.reviewState]).toEqual(["succeeded", "open", "open"]);
    await webhook.POST(signed({ id: "evt_w3", object: "event", type: "charge.dispute.closed", data: { object: { id: "dp_2", object: "dispute", payment_intent: "pi_won", status: "won", reason: "general", amount: 5000 } } }));
    w = (await getStore().getDonation(won))!;
    expect([w.status, w.disputeState]).toEqual(["succeeded", "won"]);
  });
});
