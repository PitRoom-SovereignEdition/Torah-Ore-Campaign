import { JsonStore } from "./json";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

const g = globalThis as unknown as { __store?: Store };

/** STORE=json (default, local/demo) or STORE=supabase (production). */
export function getStore(): Store {
  if (!g.__store) {
    g.__store = process.env.STORE === "supabase" ? new SupabaseStore() : new JsonStore();
  }
  return g.__store;
}
export type { Store };
