import { paymentsMode } from "../config";
import { seedDemo } from "../demo-seed";
import { JsonStore } from "./json";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

const g = globalThis as unknown as { __store?: Store };

/**
 * STORE=supabase  production (Postgres).
 * STORE=json      local files in .data/ (default for local dev).
 * STORE=memory    in-process, resets on restart. This is the default on Vercel when nothing else is
 *                 configured, so the site works with zero setup. In demo mode it starts pre-filled with
 *                 clearly-fake demo data. Never use it for real money (readiness check flags it).
 */
export function getStore(): Store {
  if (g.__store) return g.__store;
  const kind = process.env.STORE ?? (process.env.VERCEL ? "memory" : "json");
  if (kind === "supabase") return (g.__store = new SupabaseStore());
  if (kind === "memory") {
    const inner = new JsonStore({ memory: true });
    const ready = paymentsMode() === "demo" ? seedDemo(inner) : Promise.resolve();
    // Every call waits for seeding, so no request ever sees a half-filled store. Seeding itself uses `inner`.
    g.__store = new Proxy(inner, {
      get(target, prop, recv) {
        const v = Reflect.get(target, prop, recv);
        return typeof v === "function" ? async (...a: unknown[]) => { await ready; return v.apply(target, a); } : v;
      },
    }) as Store;
    return g.__store;
  }
  return (g.__store = new JsonStore());
}
export type { Store };
