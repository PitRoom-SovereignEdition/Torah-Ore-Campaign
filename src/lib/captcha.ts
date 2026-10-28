/** Optional bot protection. Set CAPTCHA_PROVIDER=turnstile|hcaptcha plus the matching keys. */
export type CaptchaProvider = "turnstile" | "hcaptcha" | null;

export function captchaProvider(): CaptchaProvider {
  const p = process.env.CAPTCHA_PROVIDER;
  if ((p === "turnstile" || p === "hcaptcha") && process.env.CAPTCHA_SECRET_KEY && process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY) return p;
  return null;
}

export async function verifyCaptcha(token: string | undefined, ip: string): Promise<boolean> {
  const p = captchaProvider();
  if (!p) return true;
  if (!token) return false;
  const url =
    p === "turnstile"
      ? "https://challenges.cloudflare.com/turnstile/v0/siteverify"
      : "https://api.hcaptcha.com/siteverify";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: process.env.CAPTCHA_SECRET_KEY!, response: token, remoteip: ip }),
    });
    const j = (await res.json()) as { success?: boolean };
    return j.success === true;
  } catch {
    return false;
  }
}
