import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DonationError } from "./donations";
import { getRole } from "./auth";
import type { Role } from "./types";

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

export function handleError(e: unknown) {
  if (e instanceof DonationError) return json({ error: e.message }, e.status);
  if (e instanceof ZodError) return json({ error: "Please check the form: " + e.issues.map((i) => i.path.join(".")).join(", ") }, 400);
  console.error(e);
  return json({ error: "Something went wrong. Please try again." }, 500);
}

/**
 * Admin API guard: must be signed in with one of `roles`, and same-origin (blocks cross-site posts).
 * Returns the caller's role so handlers can record it in the audit log.
 */
export async function requireRole(req: Request, roles: Role[]): Promise<{ role: Role } | { denied: NextResponse }> {
  const role = await getRole();
  if (!role) return { denied: json({ error: "Unauthorized" }, 401) };
  if (!roles.includes(role)) return { denied: json({ error: "Your role cannot do this." }, 403) };
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return { denied: json({ error: "Bad origin" }, 403) };
  return { role };
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new DonationError("Invalid request body.");
  }
}
