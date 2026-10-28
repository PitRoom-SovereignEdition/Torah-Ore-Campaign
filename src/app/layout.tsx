import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { LangToggle } from "@/components/LangToggle";
import { paymentsMode, stripeKeyKind } from "@/lib/config";
import { getDict } from "@/lib/i18n";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getStore().getCampaign();
  return { title: c.title, description: c.description };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, t, dir } = await getDict();
  const c = await getStore().getCampaign();
  const mode = paymentsMode();
  const banner = mode === "demo" ? t.demoBanner : mode === "stripe" && stripeKeyKind() === "test" ? t.testBanner : null;
  return (
    <html lang={lang} dir={dir}>
      <body>
        {banner && <div className={`banner ${mode === "demo" ? "demo" : "test"}`} role="status">{banner}</div>}
        <header className="topbar">
          <div className="wrap">
            <Link href="/" className="brand">{c.charityName}<span> ·</span></Link>
            <LangToggle lang={lang} label={t.language} />
          </div>
        </header>
        {children}
        <footer className="footer">
          {c.charityName}
          {c.charityRegNo ? ` · ${c.charityRegNo}` : ""}
          {c.termsUrl ? <> · <a href={c.termsUrl}>Terms</a></> : null}
          {c.contactEmail ? <> · <a href={`mailto:${c.contactEmail}`}>{c.contactEmail}</a></> : null}
        </footer>
      </body>
    </html>
  );
}
