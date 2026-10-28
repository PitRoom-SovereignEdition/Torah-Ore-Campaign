import { cookies } from "next/headers";
import { checkPassword, makeSessionValue, sessionCookie } from "@/lib/auth";
import { adminConfigured } from "@/lib/config";
import { json, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  if (!adminConfigured()) return json({ error: "Admin is not configured. Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET (16+ chars)." }, 503);
  if (!rateLimit(`login:${clientIp(req)}`, 8, 15 * 60_000)) return json({ error: "Too many attempts" }, 429);
  const { password } = await readJson<{ password?: string }>(req);
  if (!password || !checkPassword(password)) return json({ error: "Wrong password" }, 401);
  (await cookies()).set(sessionCookie.name, makeSessionValue(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionCookie.maxAge,
  });
  return json({ ok: true });
}
