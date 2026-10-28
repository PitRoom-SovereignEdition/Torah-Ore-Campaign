import { cookies } from "next/headers";
import { sessionCookie } from "@/lib/auth";
import { json } from "@/lib/http";

export async function POST() {
  (await cookies()).delete(sessionCookie.name);
  return json({ ok: true });
}
