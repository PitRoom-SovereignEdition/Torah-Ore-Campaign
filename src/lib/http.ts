import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DonationError } from "./donations";
import { isAdmin } from "./auth";

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

export function handleError(e: unknown) {
  if (e instanceof DonationError) return json({ error: e.message }, e.status);
  if (e instanceof ZodError) return json({ error: "Please check the form: " + e.issues.map((i) => i.path.join(".")).join(", ") }, 400);
  console.error(e);
  return json({ error: "Something went wrong. Please try again." }, 500);
}

/** Admin API guard. Also blocks cross-site form posts by requiring same-origin. */
export async function requireAdminApi(req: Request): Promise<NextResponse | null> {
  if (!(await isAdmin())) return json({ error: "Unauthorized" }, 401);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return json({ error: "Bad origin" }, 403);
  return null;
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new DonationError("Invalid request body.");
  }
}
