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
      } catch {
        /* keep last value */
      }
    };
    const id = setInterval(tick, 15000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [teamId]);

  const total = tot.cashCents + tot.matchedCents;
  const passed = total >= goalCents && bonusGoalCents !== null && !teamId;
  const target = passed ? bonusGoalCents! : goalCents;
  const pct = Math.round((total / goalCents) * 100);
  const cashW = Math.min(100, (tot.cashCents / target) * 100);
  const totalW = Math.min(100, (total / target) * 100);
  const fm = (c: number) => formatMoney(c, currency, locale);

  return (
    <aside className="card goal" aria-label="Campaign progress">
      {passed && (
        <div className="trophy" aria-hidden="true">
          🏆 {t.bonusGoal} · {t.originalGoal}: {fm(goalCents)} ✓
        </div>
      )}
      <div>
        <div className="big" aria-live="polite">{fm(total)}</div>
        <div className="sub">{t.raisedOf.replace("{goal}", fm(target))}</div>
      </div>
      <div className="bar" role="progressbar" aria-valuenow={Math.min(pct, 999)} aria-valuemin={0} aria-valuemax={100}>
        <i className="matched" style={{ width: `${totalW}%` }} />
        <i style={{ width: `${cashW}%` }} />
      </div>
      <div className="pct">
        <span>{pct}%</span>
        <span>{t.donationsCount.replace("{n}", String(tot.donorCount))}</span>
      </div>
      {tot.matchedCents > 0 && (
        <div className="row">
          <span>{fm(tot.cashCents)} + {fm(tot.matchedCents)}</span>
          <span>{t.matched}</span>
        </div>
      )}
      {children}
    </aside>
  );
}
