"use client";
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/money";
import type { Dict } from "@/lib/i18n";

interface Props {
  t: Dict;
  locale: string;
  currency: string;
  goalCents: number;
  bonusGoalCents: number | null;
  initial: { cashCents: number; matchedCents: number; donorCount: number };
  teamId: string | null;
  children?: React.ReactNode;
}

export function GoalCard({ t, locale, currency, goalCents, bonusGoalCents, initial, teamId, children }: Props) {
  const [tot, setTot] = useState(initial);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`/api/totals${teamId ? `?team=${encodeURIComponent(teamId)}` : ""}`, { cache: "no-store" });
        if (r.ok && !stop) setTot(await r.json());
      } catch { /* keep last value */ }
    };
    const id = setInterval(tick, 15000);
    return () => { stop = true; clearInterval(id); };
  }, [teamId]);

  const total = tot.cashCents + tot.matchedCents;
  const passed = total >= goalCents && bonusGoalCents !== null && !teamId;
  const target = passed ? bonusGoalCents! : goalCents;
  const pct = Math.round((total / goalCents) * 100);
  const cashW = Math.min(100, (tot.cashCents / target) * 100);
  const totalW = Math.min(100, (total / target) * 100);
  const fm = (c: number) => formatMoney(c, currency, locale);

  return (
    <aside className="goalcard" aria-label="Campaign progress">
      {passed && <div className="trophy">🏆 {t.bonusGoal} · {t.originalGoal}: {fm(goalCents)} ✓</div>}
      <div>
        <div className="big" aria-live="polite">{fm(total)}</div>
        <div className="label" style={{ marginTop: 6 }}>{t.raisedOf.replace("{goal}", fm(target))}</div>
      </div>
      <div className="bar" role="progressbar" aria-valuenow={Math.min(pct, 999)} aria-valuemin={0} aria-valuemax={100}>
        <i className="matched" style={{ width: `${totalW}%` }} />
        <i style={{ width: `${cashW}%` }} />
      </div>
      <div className="pct">
        <span>{pct}%</span>
        <span>{t.donationsCount.replace("{n}", tot.donorCount.toLocaleString(locale))}</span>
      </div>
      {tot.matchedCents > 0 && (
        <div className="mrow"><span aria-hidden="true">✨</span><span><b>{fm(tot.matchedCents)}</b> {t.matched}</span></div>
      )}
      {children}
    </aside>
  );
}
