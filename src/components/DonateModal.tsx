"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dict } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { Captcha } from "./Captcha";

const StripeCheckout = dynamic(() => import("./StripeCheckout").then((m) => m.StripeCheckout), { ssr: false });

type Step = { kind: "form" } | { kind: "demo"; donationId: string } | { kind: "stripe"; donationId: string; clientSecret: string; publishableKey: string };

interface Props {
  t: Dict;
  locale: string;
  mode: "disabled" | "demo" | "stripe";
  open: boolean; // campaign accepting gifts (date window)
  currency: string;
  fxRates: Record<string, number>;
  presets: number[]; // whole major units
  teamId: string | null;
  teamName: string | null;
  statementDescriptor: string;
  charityRegNo: string;
  termsUrl: string;
  captcha: { provider: "turnstile" | "hcaptcha" | null; siteKey: string };
  minCents: number;
}

export function DonateButton(props: Props) {
  const { t, mode, open } = props;
  const dlg = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>({ kind: "form" });

  if (!open) return <p className="note">{t.campaignEnded}</p>;
  if (mode === "disabled") return <button className="btn" disabled>{t.opensSoon}</button>;

  return (
    <>
      <button
        className="btn"
        onClick={() => {
          setStep({ kind: "form" });
          dlg.current?.showModal();
        }}
      >
        {t.donate}
      </button>
      <dialog ref={dlg} aria-labelledby="donate-title" onClick={(e) => e.target === dlg.current && dlg.current?.close()}>
        <div className="modal-h">
          <h2 id="donate-title">{t.donate}{props.teamName ? ` · ${props.teamName}` : ""}</h2>
          <button type="button" className="x" aria-label="Close" onClick={() => dlg.current?.close()}>×</button>
        </div>
        <div className="modal-b">
          {mode === "demo" && <p className="banner demo" style={{ borderRadius: 8, marginTop: 0 }}>{t.demoBanner}</p>}
          <Body {...props} step={step} setStep={setStep} />
        </div>
      </dialog>
    </>
  );
}

function Body(p: Props & { step: Step; setStep: (s: Step) => void }) {
  const { t, step } = p;
  if (step.kind === "demo") return <Demo t={t} donationId={step.donationId} />;
  if (step.kind === "stripe")
    return <StripeCheckout t={t} publishableKey={step.publishableKey} clientSecret={step.clientSecret} donationId={step.donationId} payLabel={t.payNow} />;
  return <DonateForm {...p} />;
}

function Demo({ t, donationId }: { t: Dict; donationId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    setBusy(true);
    const r = await fetch("/api/demo/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ donationId }) });
    if (r.ok) location.href = `/thanks?d=${donationId}`;
    else { setErr("Demo confirm failed"); setBusy(false); }
  };
  return (
    <div className="stack">
      <p className="note">{t.demoBanner}</p>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn block" onClick={go} disabled={busy}>{busy ? t.processing : t.simulate}</button>
    </div>
  );
}

function DonateForm({ t, locale, currency, fxRates, presets, teamId, statementDescriptor, charityRegNo, termsUrl, captcha, minCents, setStep }: Props & { setStep: (s: Step) => void }) {
  const currencies = useMemo(() => [currency, ...Object.keys(fxRates).filter((c) => c !== currency)], [currency, fxRates]);
  const [cur, setCur] = useState(currency);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [token, setToken] = useState("");
  const onToken = useCallback((v: string) => setToken(v), []);

  const amt = Number(amount.replace(/[,\s]/g, ""));
  const rate = cur === currency ? 1 : (fxRates[cur] ?? 0);
  const valid = Number.isFinite(amt) && amt > 0 && Math.round(amt * 100 * rate) >= minCents;

  useEffect(() => setErr(""), [amount, cur]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "");
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/donate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          currency: cur,
          teamId,
          donorName: s("donorName"), donorEmail: s("donorEmail"), reference: s("reference"),
          address: s("address"), city: s("city"), state: s("state"), zip: s("zip"), country: s("country"),
          anonymous: f.get("anonymous") === "on",
          showOnWall: f.get("showOnWall") === "on",
          message: s("message"), dedication: s("dedication"),
          acceptTerms: f.get("acceptTerms") === "on",
          captchaToken: token || undefined,
          website: s("website"),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed");
      if (j.mode === "stripe") setStep({ kind: "stripe", donationId: j.donationId, clientSecret: j.clientSecret, publishableKey: j.publishableKey });
      else setStep({ kind: "demo", donationId: j.donationId });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      <div>
        <label htmlFor="amt">{t.amount}</label>
        <div className="chips" style={{ marginBottom: 8 }}>
          {presets.map((p) => (
            <button type="button" key={p} className="chip" aria-pressed={amt === p} onClick={() => setAmount(String(p))}>
              {formatMoney(p * 100, cur, locale, true)}
            </button>
          ))}
        </div>
        <div className="grid2">
          <input id="amt" inputMode="decimal" autoComplete="off" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" aria-describedby="fx" />
          <select aria-label={t.currency} value={cur} onChange={(e) => setCur(e.target.value)}>
            {currencies.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        {cur !== currency && (
          <div id="fx" className="note">1 {cur} = {rate} {currency}</div>
        )}
      </div>

      <div className="fieldset-title">{t.yourDetails}</div>
      <div className="grid2">
        <div><label htmlFor="n">{t.name}*</label><input id="n" name="donorName" required autoComplete="name" maxLength={120} /></div>
        <div><label htmlFor="e">{t.email}*</label><input id="e" name="donorEmail" type="email" required autoComplete="email" maxLength={200} /></div>
      </div>
      <div><label htmlFor="r">{t.reference}</label><input id="r" name="reference" maxLength={120} /></div>
      <div><label htmlFor="a">{t.address}*</label><input id="a" name="address" required autoComplete="street-address" maxLength={200} /></div>
      <div className="grid2">
        <div><label htmlFor="z">{t.zip}</label><input id="z" name="zip" autoComplete="postal-code" maxLength={30} /></div>
        <div><label htmlFor="c">{t.city}*</label><input id="c" name="city" required autoComplete="address-level2" maxLength={100} /></div>
        <div><label htmlFor="s">{t.state}</label><input id="s" name="state" autoComplete="address-level1" maxLength={100} /></div>
        <div><label htmlFor="co">{t.country}*</label><input id="co" name="country" required autoComplete="country-name" maxLength={100} /></div>
      </div>

      <div><label htmlFor="m">{t.messageLabel}</label><textarea id="m" name="message" rows={2} maxLength={300} /></div>
      <div><label htmlFor="d">{t.dedication}</label><input id="d" name="dedication" maxLength={200} /></div>
      <label className="check"><input type="checkbox" name="anonymous" />{t.anonymousLabel}</label>
      <label className="check"><input type="checkbox" name="showOnWall" defaultChecked />{t.showOnWall}</label>

      <div className="hp" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>

      <label className="check">
        <input type="checkbox" name="acceptTerms" required />
        <span>{t.terms}{termsUrl && <> (<a href={termsUrl} target="_blank" rel="noreferrer">↗</a>)</>}*</span>
      </label>

      <Captcha provider={captcha.provider} siteKey={captcha.siteKey} onToken={onToken} />
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn block" disabled={!valid || busy || (!!captcha.provider && !token)}>
        {busy ? t.processing : `${t.payNow}${valid ? " · " + formatMoney(Math.round(amt * 100), cur, locale) : ""}`}
      </button>
      <p className="note center">
        {statementDescriptor && <>{t.statementShows}: {statementDescriptor}<br /></>}
        {charityRegNo}
      </p>
    </form>
  );
}
