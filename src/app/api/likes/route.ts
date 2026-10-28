import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { handleError, json, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { getStore } from "@/lib/store";

/**
 * Anonymous likes. The voter is an opaque random token in a cookie, hashed with a salt before
 * storage; nothing links a like to a person. Rate-limited per IP.
 */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`like:${clientIp(req)}`, 30, 60_000)) return json({ error: "Slow down" }, 429);
    const { donationId } = await readJson<{ donationId?: string }>(req);
    if (!donationId || donationId.length > 64) return json({ error: "Bad request" }, 400);

    const jar = await cookies();
    let token = jar.get("voter")?.value;
    if (!token) {
      token = crypto.randomUUID();
      jar.set("voter", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 });
    }
    const salt = process.env.ADMIN_SESSION_SECRET ?? "like-salt";
    const voterHash = createHash("sha256").update(`${salt}:${token}`).digest("hex");

    const store = getStore();
    const d = await store.getDonation(donationId);
    if (!d || d.status !== "succeeded" || !d.showOnWall) return json({ error: "Not found" }, 404);
    const added = await store.addLike(donationId, voterHash);
    return json({ added });
  } catch (e) {
    return handleError(e);
  }
}
