/**
 * Fills the LOCAL JSON store with clearly-fake demo data so you can see the site populated.
 * Refuses to run against Supabase or when real payments are on: fake cash must never be able
 * to inflate a real campaign total.
 */
import { newId } from "../src/lib/ids";
import { paymentsMode } from "../src/lib/config";
import { getStore } from "../src/lib/store";

if (process.env.STORE === "supabase" || paymentsMode() === "stripe") {
  console.error("Refusing to seed: STORE=supabase or PAYMENTS_MODE=stripe. Seeding is for local demo only.");
  process.exit(1);
}

async function main() {
  const store = getStore();
  const c = await store.getCampaign();
  const names = ["Moshe Cohen", "Sarah Levi", "Yossi Katz", "Rivka Stern", "David Friedman", "Esther Gold", "Avi Rosen", "Leah Klein", "Binyomin Weiss", "Chana Adler", "Shlomo Berger", "Miriam Fox"];
  const msgs = ["Hatzlacha rabbah!", "For the talmidim.", "", "Keep up the amazing work!", "In honor of our rebbi.", ""];

  const teamIds: string[] = [];
  for (const [i, n] of ["Parents Committee", "Alumni Network", "Class of 5785"].entries()) {
    const id = `demo${i + 1}`;
    teamIds.push(id);
    if (!(await store.getTeam(id)))
      await store.createTeam({ id, campaignId: c.id, name: n, goalCents: (20 + i * 15) * 1000_00, message: `Join ${n} in supporting our yeshiva!`, ownerName: n, ownerEmail: "demo@example.invalid", ownerPhone: "", approved: true, createdAt: new Date().toISOString() });
  }

  const now = Date.now();
  for (let i = 0; i < 40; i++) {
    const name = names[i % names.length];
    const cents = [1800, 3600, 10000, 18000, 36000, 100000][i % 6];
    const ts = new Date(now - (40 - i) * 3600_000).toISOString();
    await store.createDonation({
      id: newId(), campaignId: c.id, teamId: i % 3 === 0 ? null : teamIds[i % 3], amountCents: cents, currency: c.currency,
      campaignAmountCents: cents, fxRate: 1, refundedCents: 0, displayName: i % 7 === 0 ? "Anonymous" : name, anonymous: i % 7 === 0,
      showOnWall: true, message: msgs[i % msgs.length], dedication: i % 9 === 0 ? "In memory of a dear grandfather" : "",
      donorName: name, donorEmail: "demo@example.invalid", reference: "", address: "1 Demo St", city: "Demo City", state: "", zip: "", country: "USA",
      provider: "demo", paymentRef: `demo_seed_${i}`, status: "succeeded", isDemo: true, createdAt: ts, updatedAt: ts,
    });
  }
  await store.createMatcher({ id: "demomatch", campaignId: c.id, name: "Anonymous Matching Fund (demo)", multiplier: 1, capCents: 25_000_00, currency: c.currency, windowStart: new Date(now - 30 * 86400_000).toISOString(), windowEnd: new Date(now + 30 * 86400_000).toISOString() });
  console.log("Seeded demo data into", process.env.JSON_STORE_PATH ?? ".data/db.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
