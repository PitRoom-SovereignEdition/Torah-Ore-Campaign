"use client";
import Link from "next/link";
import { useState } from "react";
import { formatMoney } from "@/lib/money";
import type { Dict } from "@/lib/i18n";
import { DonorWall } from "./DonorWall";

export interface TeamRow { id: string; name: string; goalCents: number | null; cashCents: number; count: number }
export interface MatcherRow { id: string; name: string; multiplier: number; capCents: number; matchedCents: number; windowEnd: string }

interface Props {
  t: Dict;
  locale: string;
  currency: string;
  teamId: string | null;
  donorCount: number;
  teams: TeamRow[];
  matchers: MatcherRow[];
  longDescription: string;
}

export function CampaignTabs({ t, locale, currency, teamId, donorCount, teams, matchers, longDescription }: Props) {
  type Tab = "donors" | "teams" | "matchers" | "about";
  const [tab, setTab] = useState<Tab>("donors");
  const showTeams = !teamId;
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "donors", label: t.donors, count: donorCount },
    ...(showTeams ? [{ id: "teams" as Tab, label: t.teams, count: teams.length }] : []),
    ...(showTeams && matchers.length ? [{ id: "matchers" as Tab, label: t.matchers, count: matchers.length }] : []),
    { id: "about", label: t.about },
  ];
  const fm = (c: number) => formatMoney(c, currency, locale);

  return (
    <div>
      <div className="tabs" role="tablist">
        {tabs.map((x) => (
          <button key={x.id} role="tab" type="button" aria-selected={tab === x.id} onClick={() => setTab(x.id)}>
            {x.label}
            {x.count !== undefined && <span className="count">{x.count}</span>}
          </button>
        ))}
      </div>

      {tab === "donors" && <DonorWall t={t} locale={locale} teamId={teamId} />}

      {tab === "teams" && (
        <div className="scroll-x">
          <table className="t">
            <thead>
              <tr><th>{t.teamName}</th><th>{t.progress}</th><th>{t.donations}</th><th /></tr>
            </thead>
            <tbody>
              {teams.map((tm) => {
                const pct = tm.goalCents ? Math.min(100, (tm.cashCents / tm.goalCents) * 100) : null;
                return (
                  <tr key={tm.id}>
                    <td><strong>{tm.name}</strong></td>
                    <td>
                      <div>{fm(tm.cashCents)}{tm.goalCents ? ` ${t.of} ${fm(tm.goalCents)}` : ""}</div>
                      {pct !== null && <div className="bar small"><i style={{ width: `${pct}%` }} /></div>}
                    </td>
                    <td>{tm.count}</td>
                    <td><Link href={`/t/${tm.id}`}>{t.viewTeam}</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="center" style={{ marginTop: 16 }}>
            <Link href="/team-signup" className="btn secondary">{t.joinTeam}</Link>
          </p>
        </div>
      )}

      {tab === "matchers" && (
        <div className="stack">
          {matchers.map((m) => (
            <div key={m.id} className="card">
              <strong>{m.name}</strong> · {m.multiplier === 1 ? "1:1" : `${m.multiplier}×`}
              <div className="bar small" style={{ margin: "8px 0" }}>
                <i className="matched" style={{ width: `${Math.min(100, (m.matchedCents / m.capCents) * 100)}%` }} />
              </div>
              <span className="note">{fm(m.matchedCents)} {t.of} {fm(m.capCents)}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "about" && (
        <div className="card">
          {longDescription.split(/\n{2,}/).map((p, i) => <p key={i} style={{ marginTop: i ? 12 : 0 }}>{p}</p>)}
        </div>
      )}
    </div>
  );
}
