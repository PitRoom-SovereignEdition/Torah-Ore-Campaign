import { promises as fs } from "node:fs";
import path from "node:path";
import { defaultCampaign } from "../config";
import type { Campaign, Donation, Matcher, Team } from "../types";
import type { Store } from "./types";

interface DB {
  campaign: Campaign | null;
  teams: Team[];
  donations: Donation[];
  matchers: Matcher[];
  likes: { donationId: string; voterHash: string }[];
  events: string[];
}

const empty = (): DB => ({ campaign: null, teams: [], donations: [], matchers: [], likes: [], events: [] });

/**
 * File-backed store for local development and demo mode. NOT for production: serverless
 * filesystems are read-only/ephemeral and there's no concurrency control across processes.
 * Production uses the Supabase store (STORE=supabase).
 */
export class JsonStore implements Store {
  private file: string;
  private cache: DB | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  private memory: boolean;

  /**
   * `memory: true` keeps everything in process memory (no disk), for zero-config preview deploys where
   * the filesystem is read-only. Data resets whenever the server instance restarts.
   */
  constructor(opts: { file?: string; memory?: boolean } = {}) {
    this.file = opts.file ?? process.env.JSON_STORE_PATH ?? path.join(process.cwd(), ".data", "db.json");
    this.memory = !!opts.memory;
  }

  private async load(): Promise<DB> {
    if (this.cache) return this.cache;
    if (this.memory) return (this.cache = empty());
    try {
      this.cache = { ...empty(), ...(JSON.parse(await fs.readFile(this.file, "utf8")) as DB) };
    } catch {
      this.cache = empty();
    }
    return this.cache;
  }

  /** Serialise all read-modify-write cycles so concurrent requests can't interleave. */
  private tx<T>(fn: (db: DB) => T | Promise<T>, write = true): Promise<T> {
    const run = async () => {
      const db = await this.load();
      const out = await fn(db);
      if (write && !this.memory) {
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        const tmp = `${this.file}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(db, null, 2));
        await fs.rename(tmp, this.file);
      }
      return out;
    };
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => undefined);
    return p;
  }

  getCampaign() {
    return this.tx((db) => ({ ...defaultCampaign, ...(db.campaign ?? {}) }), false);
  }
  saveCampaign(patch: Partial<Campaign>) {
    return this.tx((db) => {
      db.campaign = { ...defaultCampaign, ...(db.campaign ?? {}), ...patch };
      return db.campaign;
    });
  }

  listTeams() {
    return this.tx((db) => [...db.teams], false);
  }
  getTeam(id: string) {
    return this.tx((db) => db.teams.find((t) => t.id === id) ?? null, false);
  }
  createTeam(t: Team) {
    return this.tx((db) => void db.teams.push(t));
  }
  updateTeam(id: string, patch: Partial<Team>) {
    return this.tx((db) => {
      const t = db.teams.find((x) => x.id === id);
      if (t) Object.assign(t, patch);
    });
  }

  createDonation(d: Donation) {
    return this.tx((db) => void db.donations.push(d));
  }
  getDonation(id: string) {
    return this.tx((db) => db.donations.find((d) => d.id === id) ?? null, false);
  }
  findDonationByPaymentRef(ref: string) {
    return this.tx((db) => db.donations.find((d) => d.paymentRef === ref) ?? null, false);
  }
  updateDonation(id: string, patch: Partial<Donation>) {
    return this.tx((db) => {
      const d = db.donations.find((x) => x.id === id);
      if (!d) return null;
      Object.assign(d, patch, { updatedAt: new Date().toISOString() });
      return { ...d };
    });
  }
  listDonations() {
    return this.tx((db) => db.donations.map((d) => ({ ...d })), false);
  }

  listMatchers() {
    return this.tx((db) => [...db.matchers], false);
  }
  createMatcher(m: Matcher) {
    return this.tx((db) => void db.matchers.push(m));
  }
  deleteMatcher(id: string) {
    return this.tx((db) => void (db.matchers = db.matchers.filter((m) => m.id !== id)));
  }

  addLike(donationId: string, voterHash: string) {
    return this.tx((db) => {
      if (db.likes.some((l) => l.donationId === donationId && l.voterHash === voterHash)) return false;
      db.likes.push({ donationId, voterHash });
      return true;
    });
  }
  likeCounts() {
    return this.tx((db) => {
      const out: Record<string, number> = {};
      for (const l of db.likes) out[l.donationId] = (out[l.donationId] ?? 0) + 1;
      return out;
    }, false);
  }

  recordEvent(eventId: string) {
    return this.tx((db) => {
      if (db.events.includes(eventId)) return false;
      db.events.push(eventId);
      if (db.events.length > 5000) db.events.splice(0, db.events.length - 5000);
      return true;
    });
  }
  forgetEvent(eventId: string) {
    return this.tx((db) => void (db.events = db.events.filter((e) => e !== eventId)));
  }
}
