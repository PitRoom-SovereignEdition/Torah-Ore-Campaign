"use client";
import { useEffect, useState } from "react";
import type { Dict } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";

type S = { status: string; amountCents: number; currency: string; isDemo: boolean } | null;

/** Read-only: polls the donation status. Never marks anything paid; the signed webhook does that. */
export function ThanksStatus({ id, t, locale }: { id: string; t: Dict; locale: string }) {
  const [s, setS] = useState<S>(null);
  useEffect(() => {
    if (!id) return;
    let stop = false;
    let tries = 0;
    const tick = async () => {
      const r = await fetch(`/api/donation/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (r.ok && !stop) {
        const j = (await r.json()) as NonNullable<S>;
        setS(j);
        if (j.status === "pending" && ++tries < 40) setTimeout(tick, 3000);
      }
    };
    tick();
    return () => { stop = true; };
  }, [id]);

  if (!s) return <p className="note">{t.processing}</p>;
  return (
    <div className="card" role="status">
      <p style={{ fontWeight: 800, fontSize: 22, margin: 0 }}>{formatMoney(s.amountCents, s.currency, locale)}</p>
      {s.status === "succeeded" && <p className="ok">{t.thanksBody}</p>}
      {s.status === "pending" && <p>{t.thanksPending}</p>}
      {(s.status === "failed") && <p className="err">{t.thanksFailed}</p>}
      {s.status === "flagged" && <p>{t.thanksPending}</p>}
      {s.isDemo && <p className="note">{t.demoBanner}</p>}
    </div>
  );
}
