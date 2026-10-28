"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/money";
import type { Dict } from "@/lib/i18n";
import type { PublicDonation } from "@/lib/types";

type Sort = "latest" | "highest" | "liked";

export function DonorWall({ t, locale, teamId }: { t: Dict; locale: string; teamId: string | null }) {
  const [items, setItems] = useState<PublicDonation[]>([]);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<Sort>("latest");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const reqId = useRef(0);

  const load = useCallback(
    async (offset: number, replace: boolean) => {
      const my = ++reqId.current;
      setLoading(true);
      const p = new URLSearchParams({ sort, q, offset: String(offset), limit: "12" });
      if (teamId) p.set("team", teamId);
      try {
        const r = await fetch(`/api/wall?${p}`, { cache: "no-store" });
        const j = (await r.json()) as { items: PublicDonation[]; total: number };
        if (my !== reqId.current) return; // stale response
        setItems((prev) => (replace ? j.items : [...prev, ...j.items]));
        setTotal(j.total);
      } finally {
        if (my === reqId.current) setLoading(false);
      }
    },
    [sort, q, teamId],
  );

  useEffect(() => {
    const id = setTimeout(() => load(0, true), q ? 250 : 0);
    return () => clearTimeout(id);
  }, [load, q]);

  const like = async (id: string) => {
    if (liked.has(id)) return;
    setLiked((s) => new Set(s).add(id));
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, likes: x.likes + 1 } : x)));
    const r = await fetch("/api/likes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ donationId: id }) });
    const j = r.ok ? ((await r.json()) as { added: boolean }) : null;
    if (!j?.added) setItems((xs) => xs.map((x) => (x.id === id ? { ...x, likes: Math.max(0, x.likes - 1) } : x)));
  };

  return (
    <section aria-label={t.donors}>
      <div className="toolbar">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchDonors} aria-label={t.searchDonors} />
        <div className="sorts" role="group">
          {(["latest", "highest", "liked"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)}>
              {s === "latest" ? t.latest : s === "highest" ? t.highest : t.mostLiked}
            </button>
          ))}
        </div>
      </div>

      {!loading && items.length === 0 ? (
        <p className="empty">{t.noDonors}</p>
      ) : (
        <div className="wall">
          {items.map((d) => (
            <article key={d.id} className="card donor">
              <div className="avatar" aria-hidden="true">{d.initials}</div>
              <div>
                <div className="who">{d.displayName === "Anonymous" ? t.anonymous : d.displayName}</div>
                <div className="amt">{formatMoney(d.amountCents, d.currency, locale)}</div>
                {d.teamName && (
                  <div className="with">
                    {t.with} <a href={`/t/${d.teamId}`}>{d.teamName}</a>
                  </div>
                )}
                {d.message && <p className="msg">{d.message}</p>}
                {d.dedication && <div className="ded">🕯️ {d.dedication}</div>}
                <div className="foot">
                  <span className="note">{new Date(d.createdAt).toLocaleDateString(locale)}</span>
                  <button type="button" className="like" aria-pressed={liked.has(d.id)} aria-label={t.likeLabel} onClick={() => like(d.id)}>
                    ♥ {d.likes}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {items.length < total && (
        <p className="center" style={{ marginTop: 18 }}>
          <button type="button" className="btn secondary" disabled={loading} onClick={() => load(items.length, false)}>
            {t.loadMore}
          </button>
        </p>
      )}
    </section>
  );
}
