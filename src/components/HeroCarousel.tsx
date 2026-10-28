"use client";
import { useEffect, useState } from "react";

/** Crossfading hero background. Pauses on hover and when the tab is hidden; static for reduced-motion users. */
export function HeroCarousel({ images, intervalMs = 6000 }: { images: string[]; intervalMs?: number }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const many = images.length > 1;

  useEffect(() => {
    if (!many || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => { if (!document.hidden) setI((n) => (n + 1) % images.length); }, intervalMs);
    return () => clearInterval(id);
  }, [many, paused, images.length, intervalMs]);

  return (
    <div className="carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} role="group" aria-roledescription="carousel" aria-label="Campaign photos">
      {images.map((src, n) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="" className={n === i ? "on" : ""} aria-hidden={n !== i} loading={n === 0 ? "eager" : "lazy"} />
      ))}
      {many && (
        <div className="dots">
          {images.map((_, n) => (
            <button key={n} type="button" aria-label={`Photo ${n + 1}`} aria-current={n === i} onClick={() => setI(n)} />
          ))}
        </div>
      )}
    </div>
  );
}
