import { paymentsMode, stripeKeyKind } from "@/lib/config";
import { verifyCaptcha } from "@/lib/captcha";
import { buildPendingDonation, donateSchema, DonationError } from "@/lib/donations";
import { handleError, json, readJson } from "@/lib/http";
import { getProvider } from "@/lib/payments";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { getStore } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    if (!rateLimit(`donate:${ip}`, 10, 10 * 60_000)) throw new DonationError("Too many attempts. Please wait a few minutes.", 429);

    const mode = paymentsMode();
    const provider = getProvider();
    if (mode === "disabled" || !provider) throw new DonationError("Donations are not open yet.", 503);

    const input = donateSchema.parse(await readJson(req));
    if (!(await verifyCaptcha(input.captchaToken, ip))) throw new DonationError("Bot check failed. Please try again.", 403);

    const store = getStore();
    const campaign = await store.getCampaign();
    const donation = await buildPendingDonation(campaign, input);
    await store.createDonation(donation);

    try {
      const session = await provider.createSession(campaign, donation);
      await store.updateDonation(donation.id, { paymentRef: session.paymentRef });
      return json({
        donationId: donation.id,
        mode,
        clientSecret: session.clientSecret ?? null,
        publishableKey: mode === "stripe" ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY : null,
        stripeTest: mode === "stripe" ? stripeKeyKind() === "test" : false,
      });
    } catch (e) {
      await store.updateDonation(donation.id, { status: "failed" });
      throw e;
    }
  } catch (e) {
    return handleError(e);
  }
}
