"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Campaign } from "@/lib/types";

async function post(url: string, body: unknown, method = "POST") {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { error?: string; note?: string };
  if (!r.ok) throw new Error(j.error ?? "Failed");
  return j;
}

export function LoginForm() {
  const [err, setErr] = useState("");
  const router = useRouter();
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await post("/api/admin/login", { password: String(new FormData(e.currentTarget).get("password")) });
          router.refresh();
        } catch (x) { setErr((x as Error).message); }
      }}
    >
      <div><label htmlFor="pw">Admin password</label><input id="pw" name="password" type="password" required autoComplete="current-password" /></div>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn">Sign in</button>
    </form>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return <button className="btn secondary small" onClick={async () => { await post("/api/admin/logout", {}); router.refresh(); }}>Sign out</button>;
}

export function ActionButton({ url, body, method, label, confirm: ask, className = "btn secondary small" }: { url: string; body: unknown; method?: string; label: string; confirm?: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={className}
      disabled={busy}
      onClick={async () => {
        if (ask && !window.confirm(ask)) return;
        setBusy(true);
        try { const j = await post(url, body, method); if (j.note) alert(j.note); router.refresh(); }
        catch (x) { alert((x as Error).message); }
        finally { setBusy(false); }
      }}
    >
      {label}
    </button>
  );
}

function useForm(url: string, build: (f: FormData) => unknown, reset = true) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  return {
    err, ok,
    onSubmit: async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      setErr(""); setOk(false);
      try {
        await post(url, build(new FormData(form)));
        setOk(true);
        if (reset) form.reset();
        router.refresh();
      } catch (x) { setErr((x as Error).message); }
    },
  };
}

const s = (f: FormData, k: string) => String(f.get(k) ?? "");
const n = (f: FormData, k: string) => Number(s(f, k).replace(/,/g, ""));

export function OfflineForm({ currencies, teams }: { currencies: string[]; teams: { id: string; name: string }[] }) {
  const { err, ok, onSubmit } = useForm("/api/admin/offline", (f) => ({
    donorName: s(f, "donorName"), donorEmail: s(f, "donorEmail"), amount: n(f, "amount"), currency: s(f, "currency"),
    teamId: s(f, "teamId") || null, anonymous: f.get("anonymous") === "on", showOnWall: f.get("showOnWall") === "on",
    message: s(f, "message"), dedication: s(f, "dedication"), reference: s(f, "reference"),
  }));
  return (
    <form className="card stack" onSubmit={onSubmit}>
      <h3>Record an offline gift (cheque, cash, DAF / voucher)</h3>
      <div className="grid2">
        <div><label>Donor name*</label><input name="donorName" required /></div>
        <div><label>Email</label><input name="donorEmail" type="email" /></div>
        <div><label>Amount*</label><input name="amount" required inputMode="decimal" /></div>
        <div><label>Currency</label><select name="currency">{currencies.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label>Team</label><select name="teamId"><option value="">(none)</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div><label>Reference (cheque #, DAF org…)</label><input name="reference" /></div>
      </div>
      <div><label>Wall message</label><input name="message" maxLength={300} /></div>
      <div><label>Dedication</label><input name="dedication" maxLength={200} /></div>
      <label className="check"><input type="checkbox" name="anonymous" />Anonymous</label>
      <label className="check"><input type="checkbox" name="showOnWall" defaultChecked />Show on public wall</label>
      {err && <div className="err">{err}</div>}{ok && <div className="ok">Recorded as pending. A second person (the other role) must verify it before it counts.</div>}
      <button className="btn">Record gift</button>
    </form>
  );
}

export function MatcherForm() {
  const { err, ok, onSubmit } = useForm("/api/admin/matchers", (f) => ({
    name: s(f, "name"), multiplier: n(f, "multiplier"), cap: n(f, "cap"),
    windowStart: new Date(s(f, "windowStart")).toISOString(), windowEnd: new Date(s(f, "windowEnd")).toISOString(),
  }));
  return (
    <form className="card stack" onSubmit={onSubmit}>
      <h3>Add a matcher</h3>
      <p className="note">Matching adds <b>multiplier × each cash gift</b> inside the window until the cap is reached. Matched money is tracked separately from cash and recomputed from real donations, so refunds free up cap automatically. Only record pledges the matcher has actually committed to.</p>
      <div className="grid2">
        <div><label>Matcher name*</label><input name="name" required /></div>
        <div><label>Multiplier* (1 = dollar-for-dollar)</label><input name="multiplier" defaultValue="1" required inputMode="decimal" /></div>
        <div><label>Cap* (campaign currency)</label><input name="cap" required inputMode="decimal" /></div>
        <div />
        <div><label>Window start*</label><input name="windowStart" type="datetime-local" required /></div>
        <div><label>Window end*</label><input name="windowEnd" type="datetime-local" required /></div>
      </div>
      {err && <div className="err">{err}</div>}{ok && <div className="ok">Added.</div>}
      <button className="btn">Add matcher</button>
    </form>
  );
}

export function CampaignForm({ c }: { c: Campaign }) {
  const { err, ok, onSubmit } = useForm("/api/admin/campaign", (f) => {
    const fx: Record<string, number> = {};
    for (const line of s(f, "fx").split("\n")) {
      const m = line.trim().match(/^([A-Za-z]{3})\s*[=:]\s*([\d.]+)$/);
      if (m) fx[m[1].toUpperCase()] = Number(m[2]);
    }
    return {
      title: s(f, "title"), subtitle: s(f, "subtitle"), description: s(f, "description"), longDescription: s(f, "longDescription"),
      goal: n(f, "goal"), bonusGoal: n(f, "bonusGoal") || null, currency: s(f, "currency"), fxRates: fx,
      startsAt: s(f, "startsAt") ? new Date(s(f, "startsAt")).toISOString() : null,
      endsAt: s(f, "endsAt") ? new Date(s(f, "endsAt")).toISOString() : null,
      videoUrl: s(f, "videoUrl"), charityName: s(f, "charityName"), charityRegNo: s(f, "charityRegNo"),
      statementDescriptor: s(f, "statementDescriptor"), receiptFooter: s(f, "receiptFooter"), termsUrl: s(f, "termsUrl"), contactEmail: s(f, "contactEmail"),
      leaderboardBasis: s(f, "leaderboardBasis"), selfDonation: s(f, "selfDonation"),
      cutoffAt: s(f, "cutoffAt") ? new Date(s(f, "cutoffAt")).toISOString() : null, leaderboardRules: s(f, "leaderboardRules"),
    };
  }, false);
  const local = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
  return (
    <form className="card stack" onSubmit={onSubmit}>
      <div className="grid2">
        <div><label>Campaign title</label><input name="title" defaultValue={c.title} required /></div>
        <div><label>Subtitle</label><input name="subtitle" defaultValue={c.subtitle} /></div>
      </div>
      <div><label>Short description</label><textarea name="description" rows={2} defaultValue={c.description} maxLength={600} /></div>
      <div><label>About (blank line = new paragraph)</label><textarea name="longDescription" rows={6} defaultValue={c.longDescription} /></div>
      <div className="grid2">
        <div><label>Goal</label><input name="goal" defaultValue={c.goalCents / 100} required inputMode="decimal" /></div>
        <div><label>Bonus goal (shown after goal is passed)</label><input name="bonusGoal" defaultValue={c.bonusGoalCents ? c.bonusGoalCents / 100 : ""} inputMode="decimal" /></div>
        <div><label>Campaign currency</label><input name="currency" defaultValue={c.currency} required maxLength={3} /></div>
        <div><label>Video URL (Vimeo / YouTube)</label><input name="videoUrl" defaultValue={c.videoUrl ?? ""} /></div>
        <div><label>Starts</label><input name="startsAt" type="datetime-local" defaultValue={local(c.startsAt)} /></div>
        <div><label>Ends</label><input name="endsAt" type="datetime-local" defaultValue={local(c.endsAt)} /></div>
      </div>
      <div>
        <label>Other currencies and rate into the campaign currency (one per line, e.g. GBP=1.30)</label>
        <textarea name="fx" rows={4} defaultValue={Object.entries(c.fxRates).map(([k, v]) => `${k}=${v}`).join("\n")} />
        <p className="note">Rates are fixed by you and recorded on each gift; they drive totals and the on-screen conversion note only. The card is charged in the currency the donor picked.</p>
      </div>
      <div className="grid2">
        <div><label>Legal / charity name</label><input name="charityName" defaultValue={c.charityName} /></div>
        <div><label>Registration number</label><input name="charityRegNo" defaultValue={c.charityRegNo} /></div>
        <div><label>Card statement descriptor (max 22)</label><input name="statementDescriptor" defaultValue={c.statementDescriptor} maxLength={22} /></div>
        <div><label>Terms URL</label><input name="termsUrl" defaultValue={c.termsUrl} /></div>
        <div><label>Contact email</label><input name="contactEmail" defaultValue={c.contactEmail} /></div>
      </div>
      <div className="fieldset-title">Leaderboard rules (published on the site)</div>
      <div className="grid2">
        <div><label>Who wins? (decide before launch)</label><select name="leaderboardBasis" defaultValue={c.leaderboardBasis}><option value="money">Most money raised</option><option value="gifts">Most gifts</option><option value="donors">Most distinct donors</option></select></div>
        <div><label>Fundraiser&apos;s own gift to their own page</label><select name="selfDonation" defaultValue={c.selfDonation}><option value="count">Counts toward their ranking</option><option value="exclude">Does not count</option></select></div>
        <div><label>Ranking cutoff (provisional until then)</label><input name="cutoffAt" type="datetime-local" defaultValue={local(c.cutoffAt)} /></div>
      </div>
      <div><label>Rules text (blank = generated from the settings above)</label><textarea name="leaderboardRules" rows={4} defaultValue={c.leaderboardRules} /></div>
      <div><label>Receipt footer (wording supplied by the yeshiva&apos;s advisers)</label><textarea name="receiptFooter" rows={3} defaultValue={c.receiptFooter} /></div>
      {err && <div className="err">{err}</div>}{ok && <div className="ok">Saved.</div>}
      <button className="btn">Save campaign</button>
    </form>
  );
}

/** Review decision with a mandatory written reason. Everything lands in the audit log. */
export function ReviewActions({ id, state, canAct }: { id: string; state: string; canAct: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!canAct) return null;
  const go = async (action: string) => {
    if (reason.trim().length < 3) { alert("Write a short reason first. It is recorded in the audit log."); return; }
    setBusy(true);
    try { await post("/api/admin/review", { id, action, reason }); setReason(""); router.refresh(); }
    catch (x) { alert((x as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <div className="stack" style={{ gap: 8, minWidth: 220 }}>
      <input aria-label="Reason" placeholder="Reason (required, logged)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {state === "excluded" ? (
          <button className="btn small" disabled={busy} onClick={() => go("restore")}>Restore to ranking</button>
        ) : (
          <>
            <button className="btn secondary small" disabled={busy} onClick={() => go("clear")}>Clear</button>
            <button className="btn small" disabled={busy} onClick={() => go("exclude")}>Set aside from ranking</button>
          </>
        )}
      </div>
    </div>
  );
}

export function VerifyActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const go = async (action: "verify" | "reject") => {
    const reason = action === "reject" ? window.prompt("Reason for rejecting this offline gift?") ?? "" : "";
    if (action === "reject" && !reason) return;
    setBusy(true);
    try { await post("/api/admin/offline/verify", { id, action, reason }); router.refresh(); }
    catch (x) { alert((x as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button className="btn small" disabled={busy} onClick={() => go("verify")}>Verify</button>
      <button className="btn secondary small" disabled={busy} onClick={() => go("reject")}>Reject</button>
    </div>
  );
}
