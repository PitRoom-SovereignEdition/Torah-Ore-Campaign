"use client";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => void };
    hcaptcha?: { render: (el: HTMLElement, o: Record<string, unknown>) => void };
  }
}

/** Renders Turnstile or hCaptcha when configured (CAPTCHA_PROVIDER + NEXT_PUBLIC_CAPTCHA_SITE_KEY); otherwise nothing. */
export function Captcha({ provider, siteKey, onToken }: { provider: "turnstile" | "hcaptcha" | null; siteKey: string; onToken: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!provider || !ref.current) return;
    const src =
      provider === "turnstile"
        ? "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        : "https://js.hcaptcha.com/1/api.js?render=explicit";
    const render = () => {
      const api = provider === "turnstile" ? window.turnstile : window.hcaptcha;
      if (api && ref.current && !ref.current.hasChildNodes()) api.render(ref.current, { sitekey: siteKey, callback: onToken });
    };
    let s = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (!s) {
      s = document.createElement("script");
      s.src = src;
      s.async = true;
      document.head.appendChild(s);
    }
    if ((provider === "turnstile" && window.turnstile) || (provider === "hcaptcha" && window.hcaptcha)) render();
    else s.addEventListener("load", render, { once: true });
  }, [provider, siteKey, onToken]);
  return provider ? <div ref={ref} /> : null;
}
