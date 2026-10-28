"use client";
import { useEffect, useState } from "react";

export function Countdown({ endsAt, labels }: { endsAt: string; labels: [string, string, string, string] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, new Date(endsAt).getTime() - (now ?? new Date(endsAt).getTime()));
  const parts = [Math.floor(left / 86400000), Math.floor(left / 3600000) % 24, Math.floor(left / 60000) % 60, Math.floor(left / 1000) % 60];
  return (
    <div className="countdown" role="timer" aria-label="Time left in the campaign">
      {parts.map((v, i) => (
        <div className="u" key={i}><b>{now === null ? "–" : String(v).padStart(2, "0")}</b><span>{labels[i]}</span></div>
      ))}
    </div>
  );
}
