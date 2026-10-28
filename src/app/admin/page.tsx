import Link from "next/link";
import { ActionButton, CampaignForm, LoginForm, LogoutButton, MatcherForm, OfflineForm, ReviewActions, VerifyActions } from "@/components/AdminForms";
import { getRole } from "@/lib/auth";
import { adminConfigured, financeConfigured, organizerSeesContact, paymentsMode } from "@/lib/config";
import { getLeaderboard, getTotals } from "@/lib/donations";
import { formatMoney } from "@/lib/money";
import { readiness } from "@/lib/readiness";
import { SIGNALS, type SignalCode } from "@/lib/risk";
import { getStore } from "@/lib/store";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

const ALL_TABS = ["overview", "donations", "review", "teams", "matchers", "campaign", "audit"] as const;
type Tab = (typeof ALL_TABS)[number];
const ROLE_TABS: Record<string, readonly Tab[]> = {
  organizer: ALL_TABS,
  finance: ["overview", "donations", "audit"],
};

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (!adminConfigured()) {
    return (
      <main className="wrap page" style={{ maxWidth: 640 }}>
        <h1>Admin</h1>
        <p className="card">Set <code>ADMIN_PASSWORD</code> and <code>ADMIN_SESSION_SECRET</code> (16+ random characters) in your environment to enable the admin panel. Optionally set <code>FINANCE_PASSWORD</code> for a second role.</p>
      </main>
    );
  }
  const role = await getRole();
  if (!role) {
    return (
      <main className="wrap page" style={{ maxWidth: 420 }}>
        <h1 style={{ marginBottom: 16 }}>Admin sign in</h1>
        <LoginForm />
      </main>
    );
  }

  const sp = await searchParams;
  const tabs = ROLE_TABS[role];
  const tab: Tab = (tabs as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "overview";
  const store = getStore();
  const c = await store.getCampaign();
  const [donations, teams, totals, board, audit] = await Promise.all([store.listDonations(), store.listTeams(), getTotals(c, 0), getLeaderboard(c, 0), store.listAudit(tab === "audit" ? 300 : 0)]);
  const fm = (x: number, cur = c.currency) => formatMoney(x, cur);
  const { checks, liveReady } = readiness(c);
  const mode = paymentsMode();
  const contact = role === "finance" || organizerSeesContact();
  const recent = [...donations].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const hourAgo = Date.now() - 3600_000;
  const failedHour = donations.filter((d) => d.status === "failed" && Date.parse(d.createdAt) > hourAgo).length;
  const pendingOffline = donations.filter((d) => d.provider === "offline" && d.status === "pending");
  const openReviews = donations.filter((d) => d.reviewState === "open");
  const excluded = donations.filter((d) => d.reviewState === "excluded");
  const label = (sig: string) => SIGNALS[sig as SignalCode]?.label ?? sig;

  return (
    <main className="wrap page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 }}>
        <h1>Admin <span className="pill">{role}</span></h1>
        <LogoutButton />
      </div>
      <nav className="admin-tabs" aria-label="Admin sections">
        {tabs.map((t) => (
          <Link key={t} href={`/admin?tab=${t}`} aria-current={tab === t ? "page" : undefined}>
            {t[0].toUpperCase() + t.slice(1)}
            {t === "review" && openReviews.length ? ` (${openReviews.length})` : ""}
            {t === "donations" && pendingOffline.length ? ` (${pendingOffline.length} to verify)` : ""}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <>
          {failedHour >= 10 && (
            <div className="card" role="alert" style={{ borderColor: "var(--bad)", marginBottom: 16 }}>
              <strong style={{ color: "var(--bad)" }}>Possible card testing:</strong> {failedHour} failed payments in the last hour. Check Stripe → Radar, tighten rules, and see docs/FRAUD-AND-LEADERBOARD.md. Do not refund on suspicion alone.
            </div>
          )}
          <div className="kpis">
            <div className="card kpi"><div className="v">{fm(totals.cashCents)}</div><div className="l">Cash raised</div></div>
            <div className="card kpi"><div className="v">{fm(totals.matchedCents)}</div><div className="l">Matched (separate)</div></div>
            <div className="card kpi"><div className="v">{totals.donorCount}</div><div className="l">Gifts</div></div>
            <div className="card kpi"><div className="v">{openReviews.length}</div><div className="l">Open reviews</div></div>
            <div className="card kpi"><div className="v">{pendingOffline.length}</div><div className="l">Offline gifts to verify</div></div>
            <div className="card kpi"><div className="v">{failedHour}</div><div className="l">Failed payments, last hour</div></div>
          </div>
          <div className="card">
            <h2 style={{ marginBottom: 6 }}>Payment system · <span className={`pill ${mode === "stripe" ? "ok" : "warn"}`}>{mode}</span></h2>
            <p className="note" style={{ marginBottom: 12 }}>
              Payments are switched on by environment variables, never by a button on the website.
              Status: {liveReady ? <strong className="ok">all blocking checks pass.</strong> : <strong className="err">not ready for real money yet.</strong>} See <code>docs/GO-LIVE.md</code>.
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
          {pendingOffline.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: 8 }}>Offline gifts waiting for a second person</h3>
              <div className="scroll-x"><table className="t"><tbody>
                {pendingOffline.map((d) => (
                  <tr key={d.id}>
                    <td>{d.donorName}<div className="note">{d.reference} · entered by {d.enteredBy}</div></td>
                    <td>{fm(d.amountCents, d.currency)}</td>
                    <td>{d.enteredBy === role ? <span className="note">Needs the {d.enteredBy === "organizer" ? "finance" : "organizer"} login</span> : <VerifyActions id={d.id} />}</td>
                  </tr>
                ))}
              </tbody></table></div>
              {!financeConfigured() && <p className="note">Set FINANCE_PASSWORD to enable the second login that verifies offline gifts.</p>}
            </div>
          )}
          <div><a className="btn secondary small" href="/api/admin/export">Download CSV{contact ? " (includes donor contact details)" : " (contact details removed for your role)"}</a></div>
          <div className="scroll-x">
            <table className="t">
              <thead><tr><th>When</th><th>Donor</th><th>Amount</th><th>Team</th><th>Status</th><th /></tr></thead>
              <tbody>
                {recent.map((d) => (
                  <tr key={d.id}>
                    <td className="note">{d.createdAt.slice(0, 16).replace("T", " ")}</td>
                    <td>{contact ? d.donorName : d.displayName}<div className="note">{contact ? d.donorEmail : d.donorId}{d.isDemo ? " · DEMO" : ""}{d.provider === "offline" ? " · offline" : ""}</div></td>
                    <td>{fm(d.amountCents, d.currency)}{d.currency !== c.currency ? <div className="note">= {fm(d.campaignAmountCents)}</div> : null}{d.refundedCents ? <div className="note">refunded {fm(d.refundedCents, d.currency)}</div> : null}</td>
                    <td>{d.teamId ? teamName.get(d.teamId) ?? d.teamId : "—"}</td>
                    <td>
                      <span className={`pill ${d.status === "succeeded" ? "ok" : d.status === "pending" ? "" : d.status === "flagged" ? "warn" : "bad"}`}>{d.status}</span>
                      {d.reviewState === "open" && <> <span className="pill warn">review</span></>}
                      {d.reviewState === "excluded" && <> <span className="pill bad">set aside</span></>}
                      {d.disputeState !== "none" && <> <span className="pill warn">dispute {d.disputeState}</span></>}
                    </td>
                    <td>{d.status === "succeeded" && <ActionButton url="/api/admin/refund" body={{ id: d.id }} label="Refund" confirm={`Refund the full ${fm(d.amountCents, d.currency)}?`} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <OfflineForm currencies={[c.currency, ...Object.keys(c.fxRates)]} teams={teams.filter((t) => t.approved).map((t) => ({ id: t.id, name: t.name }))} />
        </div>
      )}

      {tab === "review" && (
        <div className="stack">
          <p className="note">Signals are reasons to look, not proof: families, roommates, a dorm or shared Wi-Fi produce legitimate repeats. Nothing is excluded automatically. Setting a gift aside removes it from the <strong>leaderboard only</strong> (the money still counts in the campaign total). Fundraisers never see flags. Every decision needs a reason and is logged.</p>
          <h3>Open reviews ({openReviews.length})</h3>
          <div className="scroll-x">
            <table className="t">
              <tbody>
                {openReviews.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{fm(d.amountCents, d.currency)}</strong> to {d.teamId ? teamName.get(d.teamId) : "(no team)"}<div className="note">{d.createdAt.slice(0, 16).replace("T", " ")} · donor {d.donorId} · {d.provider}</div>
                      {d.cardChecks && <div className="note">card checks: cvc {d.cardChecks.cvc ?? "?"}, postal {d.cardChecks.postal ?? "?"}{d.cardFunding ? `, ${d.cardFunding}` : ""}{d.cardCountry ? `, ${d.cardCountry}` : ""}</div>}</td>
                    <td><ul style={{ margin: 0, paddingInlineStart: 18 }}>{d.signals.map((sg) => <li key={sg}>{label(sg)}</li>)}{d.disputeState === "open" && !d.signals.includes("dispute_open") && <li>{label("dispute_open")}</li>}</ul></td>
                    <td><ReviewActions id={d.id} state={d.reviewState} canAct={role === "organizer"} /></td>
                  </tr>
                ))}
                {openReviews.length === 0 && <tr><td className="empty">Nothing to review.</td></tr>}
              </tbody>
            </table>
          </div>
          <h3>Set aside from ranking ({excluded.length})</h3>
          <div className="scroll-x">
            <table className="t"><tbody>
              {excluded.map((d) => (
                <tr key={d.id}><td>{fm(d.amountCents, d.currency)} to {d.teamId ? teamName.get(d.teamId) : "—"}<div className="note">{d.signals.map(label).join("; ")}</div></td><td><ReviewActions id={d.id} state="excluded" canAct={role === "organizer"} /></td></tr>
              ))}
              {excluded.length === 0 && <tr><td className="empty">None.</td></tr>}
            </tbody></table>
          </div>
        </div>
      )}

      {tab === "teams" && (
        <div className="stack">
          <div className="card">
            <h3 style={{ marginBottom: 4 }}>Current ranking ({c.leaderboardBasis === "money" ? "most money" : c.leaderboardBasis === "gifts" ? "most gifts" : "most distinct donors"})</h3>
            <ol style={{ margin: 0, paddingInlineStart: 20 }}>{board.map((r) => <li key={r.teamId}>{r.name}: {fm(r.cashCents)} · {r.gifts} gifts · {r.donors} donors</li>)}</ol>
          </div>
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
                    <td><ActionButton url="/api/admin/teams" body={{ id: t.id, approved: !t.approved }} label={t.approved ? "Unpublish" : "Approve"} className={t.approved ? "btn secondary small" : "btn small"} /></td>
                  </tr>
                ))}
                {teams.length === 0 && <tr><td colSpan={5} className="empty">No team sign-ups yet.</td></tr>}
              </tbody>
            </table>
          </div>
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

      {tab === "audit" && (
        <div className="scroll-x">
          <table className="t">
            <thead><tr><th>When</th><th>Who</th><th>What</th><th>Target</th><th>Detail</th></tr></thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="note">{a.at.slice(0, 19).replace("T", " ")}</td>
                  <td><span className="pill">{a.actor}</span></td>
                  <td><strong>{a.action}</strong></td>
                  <td className="note">{a.targetType} {a.targetId.slice(0, 8)}</td>
                  <td className="note" style={{ overflowWrap: "anywhere" }}>{JSON.stringify(a.detail)}</td>
                </tr>
              ))}
              {audit.length === 0 && <tr><td colSpan={5} className="empty">Nothing logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
