import { JsonStore } from "./json";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

const g = globalThis as unknown as { __store?: Store };

/**
 * STORE=supabase  production (Postgres).
 * STORE=json      local files in .data/ (default for local dev).
 * STORE=memory    in-process, starts EMPTY, resets on restart. Default on Vercel when nothing else is
 *                 configured, so the site works with zero setup. Never use it for real money
 *                 (the readiness check flags it).
 */
export function getStore(): Store {
  if (g.__store) return g.__store;
  const kind = process.env.STORE ?? (process.env.VERCEL ? "memory" : "json");
  if (kind === "supabase") return (g.__store = new SupabaseStore());
  if (kind === "memory") return (g.__store = new JsonStore({ memory: true }));
  return (g.__store = new JsonStore());
}
export type { Store };
