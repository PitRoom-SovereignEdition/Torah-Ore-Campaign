import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

process.env.JSON_STORE_PATH = path.join(mkdtempSync(path.join(tmpdir(), "yc-")), "db.json");

const { applyPaymentEvent, buildPendingDonation, donateSchema, DonationError, getWall } = await import("@/lib/donations");
const { getStore } = await import("@/lib/store");
const { defaultCampaign } = await import("@/lib/config");

const input = (over: Record<string, unknown> = {}) =>
  donateSchema.parse({
    amount: 100, currency: "USD", donorName: "Test Donor", donorEmail: "t@example.com", address: "1 A St", city: "X", country: "USA",
    acceptTerms: true, ...over,
  });

async function newPending(over: Record<string, unknown> = {}, ref = `pi_${Math.random()}`) {
  const d = await buildPendingDonation(defaultCampaign, input(over));
  await getStore().createDonation({ ...d, paymentRef: ref });
  return { d, ref };
}

beforeEach(() => {
  process.env.PAYMENTS_MODE = "stripe";
});

describe("server-side pricing", () => {
  it("converts to campaign currency with the server rate, ignoring client claims", async () => {
    const d = await buildPendingDonation(defaultCampaign, input({ amount: 100, currency: "GBP" }));
    expect(d.amountCents).toBe(10000);
    expect(d.campaignAmountCents).toBe(13000);
    expect(d.status).toBe("pending");
  });
  it("rejects unsupported currencies and out-of-range amounts", async () => {
    await expect(buildPendingDonation(defaultCampaign, input({ currency: "JPY" }))).rejects.toBeInstanceOf(DonationError);
    await expect(buildPendingDonation(defaultCampaign, input({ amount: 0.5 }))).rejects.toBeInstanceOf(DonationError);
    await expect(buildPendingDonation(defaultCampaign, input({ amount: 99_999_999 }))).rejects.toBeInstanceOf(DonationError);
  });
  it("rejects unknown or unapproved teams", async () => {
    await expect(buildPendingDonation(defaultCampaign, input({ teamId: "nope" }))).rejects.toBeInstanceOf(DonationError);
  });
  it("requires terms and a clean honeypot", () => {
    expect(() => donateSchema.parse({ ...input(), acceptTerms: false })).toThrow();
    expect(() => donateSchema.parse({ ...input(), website: "http://spam" })).toThrow();
  });
  it("refuses donations outside the campaign window", async () => {
    await expect(buildPendingDonation({ ...defaultCampaign, endsAt: "2020-01-01T00:00:00Z" }, input())).rejects.toBeInstanceOf(DonationError);
  });
});

describe("payment state machine", () => {
  it("only the processor event makes a donation succeed, and it is idempotent", async () => {
    const { d, ref } = await newPending();
    expect((await getStore().getDonation(d.id))!.status).toBe("pending");
    const ev = { type: "succeeded", paymentRef: ref, amountCents: 10000, currency: "usd" } as const;
    expect((await applyPaymentEvent(ev)).changed).toBe(true);
    expect((await applyPaymentEvent(ev)).changed).toBe(false);
    expect((await getStore().getDonation(d.id))!.status).toBe("succeeded");
  });

  it("flags (and does not count) a charge whose amount differs from what we priced", async () => {
    const { d, ref } = await newPending();
    await applyPaymentEvent({ type: "succeeded", paymentRef: ref, amountCents: 100, currency: "usd" });
    expect((await getStore().getDonation(d.id))!.status).toBe("flagged");
  });

  it("a late failure cannot undo a success", async () => {
    const { d, ref } = await newPending();
    await applyPaymentEvent({ type: "succeeded", paymentRef: ref, amountCents: 10000, currency: "usd" });
    await applyPaymentEvent({ type: "failed", paymentRef: ref });
    expect((await getStore().getDonation(d.id))!.status).toBe("succeeded");
  });

  it("handles partial then full refunds, and refunds cannot be undone", async () => {
    const { d, ref } = await newPending();
    await applyPaymentEvent({ type: "succeeded", paymentRef: ref, amountCents: 10000, currency: "usd" });
    await applyPaymentEvent({ type: "refunded", paymentRef: ref, refundedCents: 2500 });
    let cur = (await getStore().getDonation(d.id))!;
    expect([cur.status, cur.refundedCents]).toEqual(["succeeded", 2500]);
    await applyPaymentEvent({ type: "refunded", paymentRef: ref, refundedCents: 10000 });
    cur = (await getStore().getDonation(d.id))!;
    expect([cur.status, cur.refundedCents]).toEqual(["refunded", 10000]);
    await applyPaymentEvent({ type: "succeeded", paymentRef: ref, amountCents: 10000, currency: "usd" });
    expect((await getStore().getDonation(d.id))!.status).toBe("refunded");
  });

  it("unknown payment refs are ignored", async () => {
    expect((await applyPaymentEvent({ type: "failed", paymentRef: "pi_unknown" })).donation).toBeNull();
  });

  it("webhook event ledger is first-write-wins", async () => {
    const s = getStore();
    expect(await s.recordEvent("evt_1")).toBe(true);
    expect(await s.recordEvent("evt_1")).toBe(false);
    await s.forgetEvent("evt_1");
    expect(await s.recordEvent("evt_1")).toBe(true);
  });
});

describe("public donor wall privacy", () => {
  it("never leaks private fields and hides anonymous names / opted-out gifts", async () => {
    const a = await newPending({ donorName: "Secret Person", donorEmail: "secret@example.com", anonymous: true, message: "hi" });
    const b = await newPending({ showOnWall: false, message: "hidden" });
    const c = await newPending({ donorName: "Visible Vic", message: "shown" });
    for (const x of [a, b, c]) await applyPaymentEvent({ type: "succeeded", paymentRef: x.ref, amountCents: 10000, currency: "usd" });
    const wall = await getWall({ campaign: defaultCampaign, sort: "latest", q: "", teamId: null, offset: 0, limit: 100 });
    const dump = JSON.stringify(wall);
    expect(dump).not.toContain("secret@example.com");
    expect(dump).not.toContain("Secret Person");
    expect(dump).not.toContain("hidden");
    expect(dump).toContain("Visible Vic");
    expect(dump).toContain("Anonymous");
    expect(dump).not.toContain("donorEmail");
    expect(dump).not.toContain("address");
  });
});

describe("demo gifts never count in real mode", () => {
  it("excludes isDemo donations from the wall once PAYMENTS_MODE=stripe", async () => {
    const a = await newPending({ donorName: "Fake Demo Person" });
    await applyPaymentEvent({ type: "succeeded", paymentRef: a.ref, amountCents: 10000, currency: "usd" });
    await getStore().updateDonation(a.d.id, { isDemo: true });
    const wall = await getWall({ campaign: defaultCampaign, sort: "latest", q: "", teamId: null, offset: 0, limit: 100 });
    expect(JSON.stringify(wall)).not.toContain("Fake Demo Person");
    process.env.PAYMENTS_MODE = "demo";
    const demoWall = await getWall({ campaign: defaultCampaign, sort: "latest", q: "", teamId: null, offset: 0, limit: 100 });
    expect(JSON.stringify(demoWall)).toContain("Fake Demo Person");
  });
});
