"use client";
import { useState } from "react";

export function ShareButton({ title, label, copied }: { title: string; label: string; copied: string }) {
  const [done, setDone] = useState(false);
  const go = async () => {
    const url = location.href;
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;
    }
  };
  return (
    <button type="button" className="btn primary share small" onClick={go} aria-live="polite">
      {done ? copied : `↗ ${label}`}
    </button>
  );
}
