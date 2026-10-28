import Link from "next/link";
import { ActionButton, CampaignForm, LoginForm, LogoutButton, MatcherForm, OfflineForm } from "@/components/AdminForms";
import { isAdmin } from "@/lib/auth";
import { adminConfigured, paymentsMode } from "@/lib/config";
import { getTotals } from "@/lib/donations";
import { formatMoney } from "@/lib/money";
import { readiness } from "@/lib/readiness";
import { getStore } from "@/lib/store";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

const TABS = ["overview", "donations", "teams", "matchers", "campaign"] as const;
type Tab = (typeof TABS)[number];

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (!adminConfigured()) {
    return (
      <main className="wrap page" style={{ maxWidth: 640 }}>
        <h1>Admin</h1>
        <p className="card">Set <code>ADMIN_PASSWORD</code> and <code>ADMIN_SESSION_SECRET</code> (16+ random characters) in your environment to enable the admin panel.</p>
      </main>
    );
  }
  if (!(await isAdmin())) {
    return (
      <main className="wrap page" style={{ maxWidth: 420 }}>
        <h1 style={{ marginBottom: 16 }}>Admin sign in</h1>
        <LoginForm />
      </main>
    );
  }

  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "overview";
  const store = getStore();
  const c = await store.getCampaign();
  const [donations, teams, totals] = await Promise.all([store.listDonations(), store.listTeams(), getTotals(c, 0)]);
  const fm = (x: number, cur = c.currency) => formatMoney(x, cur);
  const { checks, liveReady } = readiness(c);
  const mode = paymentsMode();
  const recent = [...donations].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));

  return (
    <main className="wrap page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1>Admin</h1>
        <LogoutButton />
      </div>
      <nav className="admin-tabs" aria-label="Admin sections">
        {TABS.map((t) => (
          <Link key={t} href={`/admin?tab=${t}`} aria-current={tab === t ? "page" : undefined}>{t[0].toUpperCase() + t.slice(1)}</Link>
        ))}
      </nav>

      {tab === "overview" && (
        <>
          <div className="kpis">
            <div className="card kpi"><div className="v">{fm(totals.cashCents)}</div><div className="l">Cash raised</div></div>
            <div className="card kpi"><div className="v">{fm(totals.matchedCents)}</div><div className="l">Matched (separate)</div></div>
            <div className="card kpi"><div className="v">{totals.donorCount}</div><div className="l">Donors</div></div>
            <div className="card kpi"><div className="v">{donations.filter((d) => d.status === "flagged").length}</div><div className="l">Flagged for review</div></div>
            <div className="card kpi"><div className="v">{teams.filter((t) => !t.approved).length}</div><div className="l">Teams awaiting approval</div></div>
          </div>
          <div className="card">
            <h2 style={{ marginBottom: 6 }}>Payment system · <span className={`pill ${mode === "stripe" ? "ok" : "warn"}`}>{mode}</span></h2>
            <p className="note" style={{ marginBottom: 12 }}>
              Payments are switched on by environment variables, never by a button on the website, so turning on real money is a deliberate deploy.
              Status: {liveReady ? <strong className="ok">all blocking checks pass; ready for real money once the manual items are confirmed.</strong> : <strong className="err">not ready for real money yet.</strong>}
              {" "}See <code>docs/GO-LIVE.md</code>.
            </p>
            <div className="scroll-x">
              <table className="t">
                <tbody>
                  {checks.map((x) => (
                    <tr key={x.id}>
                      <td style={{ width: 90 }}><span className={`pill ${x.status === "ok" ? "ok" : x.status === "bad" ? "bad" : "warn"}`}>{x.status === "ok" ? "OK" : x.status === "bad" ? "FIX" : "CHECK"}</span></td>
                      <td><strong>{x.label}</strong>{x.blocksLive ? "" : " (recommended)"}<div className="note">{x.detail}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "donations" && (
        <div className="stack">
          <div><a className="btn secondary small" href="/api/admin/export">Download CSV (all donors, private data included)</a></div>
          <div className="scroll-x">
            <table className="t">
              <thead><tr><th>When</th><th>Donor</th><th>Amount</th><th>Team</th><th>Status</th><th /></tr></thead>
              <tbody>
                {recent.map((d) => (
                  <tr key={d.id}>
                    <td className="note">{d.createdAt.slice(0, 16).replace("T", " ")}</td>
                    <td>{d.donorName}<div className="note">{d.donorEmail}{d.isDemo ? " · DEMO" : ""}{d.provider === "offline" ? " · offline" : ""}</div></td>
                    <td>{fm(d.amountCents, d.currency)}{d.currency !== c.currency ? <div className="note">= {fm(d.campaignAmountCents)}</div> : null}{d.refundedCents ? <div className="note">refunded {fm(d.refundedCents, d.currency)}</div> : null}</td>
                    <td>{d.teamId ? teamName.get(d.teamId) ?? d.teamId : "—"}</td>
                    <td><span className={`pill ${d.status === "succeeded" ? "ok" : d.status === "pending" ? "" : d.status === "flagged" ? "warn" : "bad"}`}>{d.status}</span></td>
                    <td>{d.status === "succeeded" && <ActionButton url="/api/admin/refund" body={{ id: d.id }} label="Refund" confirm={`Refund the full ${fm(d.amountCents, d.currency)} to ${d.donorName}?`} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <OfflineForm currencies={[c.currency, ...Object.keys(c.fxRates)]} teams={teams.filter((t) => t.approved).map((t) => ({ id: t.id, name: t.name }))} />
        </div>
      )}

      {tab === "teams" && (
        <div className="scroll-x">
          <table className="t">
            <thead><tr><th>Team</th><th>Contact</th><th>Goal</th><th>Status</th><th /></tr></thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong><div className="note">{t.message}</div><div className="note">/t/{t.id}</div></td>
                  <td>{t.ownerEmail}<div className="note">{t.ownerPhone}</div></td>
                  <td>{t.goalCents ? fm(t.goalCents) : "—"}</td>
                  <td><span className={`pill ${t.approved ? "ok" : "warn"}`}>{t.approved ? "live" : "pending"}</span></td>
                  <td>
                    <ActionButton url="/api/admin/teams" body={{ id: t.id, approved: !t.approved }} label={t.approved ? "Unpublish" : "Approve"} className={t.approved ? "btn secondary small" : "btn small"} />
                  </td>
                </tr>
              ))}
              {teams.length === 0 && <tr><td colSpan={5} className="empty">No team sign-ups yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "matchers" && (
        <div className="stack">
          {totals.matchers.map((m) => (
            <div key={m.matcher.id} className="card" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <strong>{m.matcher.name}</strong> · {m.matcher.multiplier}×
                <div className="note">{fm(m.matchedCents)} of {fm(m.matcher.capCents)} used · {m.matcher.windowStart.slice(0, 16)} → {m.matcher.windowEnd.slice(0, 16)}</div>
              </div>
              <ActionButton url="/api/admin/matchers" method="DELETE" body={{ id: m.matcher.id }} label="Remove" confirm="Remove this matcher? Matched totals will drop accordingly." />
            </div>
          ))}
          <MatcherForm />
        </div>
      )}

      {tab === "campaign" && <CampaignForm c={c} />}
    </main>
  );
}
