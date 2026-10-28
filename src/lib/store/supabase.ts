import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { defaultCampaign } from "../config";
import type { AuditEntry, Campaign, Donation, Matcher, Team } from "../types";
import type { Store } from "./types";

const snake = (s: string) => s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function toRow(o: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [snake(k), v]));
}
function fromRow<T>(r: Record<string, unknown>): T {
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [camel(k), v])) as T;
}
function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`supabase ${what}: ${res.error.message}`);
  return res.data as T;
}

/**
 * Production store. Uses the SERVICE ROLE key from the server only. Every table has RLS enabled
 * with no policies for anon/authenticated, so the browser can never read donor contact details
 * even if someone finds the project URL. See supabase/migrations/0001_init.sql.
 */
export class SupabaseStore implements Store {
  private db: SupabaseClient;
  constructor(url = process.env.SUPABASE_URL!, key = process.env.SUPABASE_SERVICE_ROLE_KEY!) {
    if (!url || !key) throw new Error("STORE=supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    this.db = createClient(url, key, { auth: { persistSession: false } });
  }

  async getCampaign(): Promise<Campaign> {
    const { data, error } = await this.db.from("campaigns").select("*").eq("id", "main").maybeSingle();
    if (error) throw new Error(error.message);
    return { ...defaultCampaign, ...(data ? fromRow<Campaign>(data) : {}) };
  }
  async saveCampaign(patch: Partial<Campaign>): Promise<Campaign> {
    const merged = { ...(await this.getCampaign()), ...patch, id: "main" };
    must(await this.db.from("campaigns").upsert(toRow(merged)), "saveCampaign");
    return merged;
  }

  async listTeams() {
    const rows = must(await this.db.from("teams").select("*").order("created_at"), "listTeams");
    return (rows ?? []).map((r) => fromRow<Team>(r));
  }
  async getTeam(id: string) {
    const { data, error } = await this.db.from("teams").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow<Team>(data) : null;
  }
  async createTeam(t: Team) {
    must(await this.db.from("teams").insert(toRow(t)), "createTeam");
  }
  async updateTeam(id: string, patch: Partial<Team>) {
    must(await this.db.from("teams").update(toRow(patch)).eq("id", id), "updateTeam");
  }

  async createDonation(d: Donation) {
    must(await this.db.from("donations").insert(toRow(d)), "createDonation");
  }
  async getDonation(id: string) {
    const { data, error } = await this.db.from("donations").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow<Donation>(data) : null;
  }
  async findDonationByPaymentRef(ref: string) {
    const { data, error } = await this.db.from("donations").select("*").eq("payment_ref", ref).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow<Donation>(data) : null;
  }
  async updateDonation(id: string, patch: Partial<Donation>) {
    const { data, error } = await this.db
      .from("donations")
      .update(toRow({ ...patch, updatedAt: new Date().toISOString() }))
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow<Donation>(data) : null;
  }
  async listDonations() {
    const out: Donation[] = [];
    for (let from = 0; ; from += 1000) {
      const rows = must(
        await this.db.from("donations").select("*").order("created_at").range(from, from + 999),
        "listDonations",
      );
      out.push(...(rows ?? []).map((r) => fromRow<Donation>(r)));
      if (!rows || rows.length < 1000) break;
    }
    return out;
  }

  async listMatchers() {
    const rows = must(await this.db.from("matchers").select("*").order("created_at"), "listMatchers");
    return (rows ?? []).map((r) => fromRow<Matcher>(r));
  }
  async createMatcher(m: Matcher) {
    must(await this.db.from("matchers").insert(toRow(m)), "createMatcher");
  }
  async deleteMatcher(id: string) {
    must(await this.db.from("matchers").delete().eq("id", id), "deleteMatcher");
  }

  async addLike(donationId: string, voterHash: string) {
    const { error } = await this.db.from("likes").insert({ donation_id: donationId, voter_hash: voterHash });
    if (!error) return true;
    if (error.code === "23505") return false; // already liked
    throw new Error(error.message);
  }
  async likeCounts() {
    const out: Record<string, number> = {};
    for (let from = 0; ; from += 1000) {
      const rows = must(await this.db.from("likes").select("donation_id").range(from, from + 999), "likeCounts");
      for (const r of rows ?? []) out[r.donation_id as string] = (out[r.donation_id as string] ?? 0) + 1;
      if (!rows || rows.length < 1000) break;
    }
    return out;
  }

  async appendAudit(e: AuditEntry) {
    must(await this.db.from("audit_log").insert(toRow(e)), "appendAudit");
  }
  async listAudit(limit: number) {
    const rows = must(await this.db.from("audit_log").select("*").order("at", { ascending: false }).limit(limit), "listAudit");
    return (rows ?? []).map((r) => fromRow<AuditEntry>(r));
  }

  async recordEvent(eventId: string) {
    const { error } = await this.db.from("processed_events").insert({ id: eventId });
    if (!error) return true;
    if (error.code === "23505") return false;
    throw new Error(error.message);
  }
  async forgetEvent(eventId: string) {
    must(await this.db.from("processed_events").delete().eq("id", eventId), "forgetEvent");
  }
}
