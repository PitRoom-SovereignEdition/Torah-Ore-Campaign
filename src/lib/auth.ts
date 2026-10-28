import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { adminConfigured } from "./config";

const COOKIE = "admin_session";
const TTL_MS = 8 * 60 * 60 * 1000;

const sign = (payload: string) =>
  createHmac("sha256", process.env.ADMIN_SESSION_SECRET!).update(payload).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPassword(pw: string): boolean {
  return adminConfigured() && safeEqual(pw, process.env.ADMIN_PASSWORD!);
}

export function makeSessionValue(): string {
  const exp = String(Date.now() + TTL_MS);
  return `${exp}.${sign(exp)}`;
}

export function verifySessionValue(v: string | undefined): boolean {
  if (!v || !adminConfigured()) return false;
  const [exp, sig] = v.split(".");
  if (!exp || !sig || !safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now();
}

export const sessionCookie = { name: COOKIE, maxAge: TTL_MS / 1000 };

export async function isAdmin(): Promise<boolean> {
  return verifySessionValue((await cookies()).get(COOKIE)?.value);
}
