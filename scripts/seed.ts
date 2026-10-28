/**
 * Fills the LOCAL JSON store with clearly-fake demo data so you can see the site populated.
 * Refuses to run against Supabase or when real payments are on.
 */
import { paymentsMode } from "../src/lib/config";
import { seedDemo } from "../src/lib/demo-seed";
import { getStore } from "../src/lib/store";

if (process.env.STORE === "supabase" || paymentsMode() === "stripe") {
  console.error("Refusing to seed: STORE=supabase or PAYMENTS_MODE=stripe. Seeding is for local demo only.");
  process.exit(1);
}

seedDemo(getStore())
  .then(() => console.log("Seeded demo data into", process.env.JSON_STORE_PATH ?? ".data/db.json"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
