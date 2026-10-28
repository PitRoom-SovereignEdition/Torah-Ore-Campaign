"use client";
import { useEffect, useState } from "react";

/** Hero photos: automatic crossfade rotation. No controls, no sliding. Static for reduced-motion users. */
export function HeroCarousel({ images, intervalMs = 6000 }: { images: string[]; intervalMs?: number }) {
  const [i, setI] = useState(0);
  const many = images.length > 1;

  useEffect(() => {
    if (!many) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => { if (!document.hidden) setI((n) => (n + 1) % images.length); }, intervalMs);
    return () => clearInterval(id);
  }, [many, images.length, intervalMs]);

  return (
    <div className="carousel" aria-hidden="true">
      {images.map((src, n) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="" className={n === i ? "on" : ""} loading={n === 0 ? "eager" : "lazy"} />
      ))}
    </div>
  );
}
