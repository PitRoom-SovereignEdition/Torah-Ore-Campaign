"use client";
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/money";
import type { Dict } from "@/lib/i18n";
import type { PublicDonation } from "@/lib/types";

/** Scrolling strip of the latest public gifts. Refreshes every 20s. */
export function Ticker({ t, locale }: { t: Dict; locale: string }) {
  const [items, setItems] = useState<PublicDonation[]>([]);
  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/wall?limit=10&sort=latest", { cache: "no-store" });
        if (r.ok && !stop) setItems(((await r.json()) as { items: PublicDonation[] }).items);
      } catch { /* keep last */ }
    };
    load();
    const id = setInterval(load, 20000);
    return () => { stop = true; clearInterval(id); };
  }, []);
  if (!items.length) return null;
  const row = (suffix: string) =>
    items.map((d) => (
      <span key={d.id + suffix}>
        <span className="dot" aria-hidden="true" />
        <b>{d.displayName === "Anonymous" ? t.anonymous : d.displayName}</b> <span className="amt">{formatMoney(d.amountCents, d.currency, locale, true)}</span>
      </span>
    ));
  return (
    <div className="ticker" aria-label={t.donors}>
      <div className="track">{row("a")}{row("b")}</div>
    </div>
  );
}
