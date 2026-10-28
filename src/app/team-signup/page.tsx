import { TeamSignupForm } from "@/components/TeamSignupForm";
import { captchaProvider } from "@/lib/captcha";
import { getDict } from "@/lib/i18n";

export default async function TeamSignup() {
  const { t } = await getDict();
  return (
    <main className="wrap page" style={{ maxWidth: 640 }}>
      <h1 className="center" style={{ marginBottom: 8 }}>{t.teamSignup}</h1>
      <p className="center note" style={{ marginBottom: 20 }}>{t.teamSignupIntro}</p>
      <TeamSignupForm t={t} captcha={{ provider: captchaProvider(), siteKey: process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY ?? "" }} />
    </main>
  );
}
