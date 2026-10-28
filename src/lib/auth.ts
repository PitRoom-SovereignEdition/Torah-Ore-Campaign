import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { adminConfigured, financeConfigured } from "./config";
import type { Role } from "./types";

const COOKIE = "admin_session";
const TTL_MS = 8 * 60 * 60 * 1000;

const sign = (payload: string) => createHmac("sha256", process.env.ADMIN_SESSION_SECRET!).update(payload).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Which role (if any) a password unlocks. Organizer and finance have separate passwords. */
export function roleForPassword(pw: string): Role | null {
  if (!adminConfigured()) return null;
  if (safeEqual(pw, process.env.ADMIN_PASSWORD!)) return "organizer";
  if (financeConfigured() && safeEqual(pw, process.env.FINANCE_PASSWORD!)) return "finance";
  return null;
}

export function makeSessionValue(role: Role): string {
  const body = `${role}.${Date.now() + TTL_MS}`;
  return `${body}.${sign(body)}`;
}

export function roleFromSessionValue(v: string | undefined): Role | null {
  if (!v || !adminConfigured()) return null;
  const [role, exp, sig] = v.split(".");
  if ((role !== "organizer" && role !== "finance") || !exp || !sig) return null;
  if (!safeEqual(sig, sign(`${role}.${exp}`))) return null;
  if (Number(exp) <= Date.now()) return null;
  if (role === "finance" && !financeConfigured()) return null;
  return role;
}

export const sessionCookie = { name: COOKIE, maxAge: TTL_MS / 1000 };

export async function getRole(): Promise<Role | null> {
  return roleFromSessionValue((await cookies()).get(COOKIE)?.value);
}
