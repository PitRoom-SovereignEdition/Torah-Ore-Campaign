import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { LangToggle } from "@/components/LangToggle";
import { NavDonate } from "@/components/NavDonate";
import { campaignOpen } from "@/lib/donations";
import { paymentsMode, stripeKeyKind } from "@/lib/config";
import { getDict } from "@/lib/i18n";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getStore().getCampaign();
  return { title: c.title, description: c.description, openGraph: { title: c.title, description: c.description, images: c.heroMedia[0] ? [c.heroMedia[0]] : [] } };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, t, dir } = await getDict();
  const c = await getStore().getCampaign();
  const mode = paymentsMode();
  const banner = mode === "demo" ? t.demoBanner : mode === "stripe" && stripeKeyKind() === "test" ? t.testBanner : null;
  return (
    <html lang={lang} dir={dir}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        {banner && <div className={`banner ${mode === "demo" ? "demo" : "test"}`} role="status">{banner}</div>}
        <header className="nav">
          <div className="wrap">
            <Link href="/" className="logo"><span className="mark" aria-hidden="true">ת</span>{c.charityName}</Link>
            <nav className="nav-links" aria-label="Sections">
              <Link href="/#donors">{t.donors}</Link>
              <Link href="/#teams">{t.teams}</Link>
              <Link href="/#matchers">{t.matchers}</Link>
              <Link href="/#about">{t.about}</Link>
            </nav>
            <div className="nav-end">
              <LangToggle lang={lang} label={t.language} />
              <NavDonate label={t.donate} disabled={mode === "disabled" || !campaignOpen(c)} />
            </div>
          </div>
        </header>
        <div id="main">{children}</div>
        <footer className="footer">
          <div className="wrap">
            <div>
              <strong style={{ color: "#fff" }}>{c.charityName}</strong>
              {c.charityRegNo ? <> · {c.charityRegNo}</> : null}
              <div>{c.contactEmail ? <a href={`mailto:${c.contactEmail}`}>{c.contactEmail}</a> : null}</div>
            </div>
            <div>{c.termsUrl ? <a href={c.termsUrl}>Terms</a> : null} {t.secure} · Stripe</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
