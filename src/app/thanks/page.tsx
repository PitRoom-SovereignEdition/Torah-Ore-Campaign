import Link from "next/link";
import { ThanksStatus } from "@/components/ThanksStatus";
import { getDict } from "@/lib/i18n";

export default async function Thanks({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams;
  const { t, lang } = await getDict();
  return (
    <main className="wrap page center" style={{ maxWidth: 560 }}>
      <h1>{t.thanks}</h1>
      <ThanksStatus id={d ?? ""} t={t} locale={lang === "he" ? "he-IL" : "en-US"} />
      <p style={{ marginTop: 24 }}><Link href="/" className="btn secondary">{t.backToCampaign}</Link></p>
    </main>
  );
}
