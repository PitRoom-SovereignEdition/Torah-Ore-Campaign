"use client";
import { useCallback, useState } from "react";
import type { Dict } from "@/lib/i18n";
import { Captcha } from "./Captcha";

export function TeamSignupForm({ t, captcha }: { t: Dict; captcha: { provider: "turnstile" | "hcaptcha" | null; siteKey: string } }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  const [token, setToken] = useState("");
  const onToken = useCallback((v: string) => setToken(v), []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "");
    setState("busy");
    setErr("");
    const goal = Number(s("goal").replace(/,/g, ""));
    const r = await fetch("/api/teams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: s("name"), email: s("email"), phone: s("phone"), goal: goal > 0 ? goal : null, message: s("message"), website: s("website"), captchaToken: token || undefined }),
    });
    if (r.ok) setState("done");
    else {
      setErr(((await r.json()) as { error?: string }).error ?? "Failed");
      setState("idle");
    }
  };

  if (state === "done") return <p className="card ok center" role="status">{t.teamThanks}</p>;
  return (
    <form onSubmit={submit} className="card stack">
      <div><label htmlFor="tn">{t.teamNameLabel}*</label><input id="tn" name="name" required maxLength={120} /></div>
      <div><label htmlFor="te">{t.email}*</label><input id="te" name="email" type="email" required maxLength={200} /></div>
      <div><label htmlFor="tp">{t.phone}</label><input id="tp" name="phone" type="tel" maxLength={40} /></div>
      <div><label htmlFor="tg">{t.raisingGoal}</label><input id="tg" name="goal" inputMode="decimal" /></div>
      <div><label htmlFor="tm">{t.teamMessage}</label><textarea id="tm" name="message" rows={3} maxLength={500} /></div>
      <div className="hp" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <Captcha provider={captcha.provider} siteKey={captcha.siteKey} onToken={onToken} />
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn" disabled={state === "busy" || (!!captcha.provider && !token)}>{t.submit}</button>
    </form>
  );
}
