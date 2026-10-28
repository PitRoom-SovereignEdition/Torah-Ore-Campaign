import { z } from "zod";
import { verifyCaptcha } from "@/lib/captcha";
import { DonationError, invalidateTotals } from "@/lib/donations";
import { handleError, json, readJson } from "@/lib/http";
import { newId, nowIso } from "@/lib/ids";
import { paymentsMode } from "@/lib/config";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { getStore } from "@/lib/store";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).default(""),
  goal: z.number().positive().max(10_000_000).nullish(),
  message: z.string().trim().max(500).default(""),
  captchaToken: z.string().max(4000).optional(),
  website: z.string().max(0).optional(),
});

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    if (!rateLimit(`team:${ip}`, 5, 60 * 60_000)) throw new DonationError("Too many sign-ups. Try again later.", 429);
    const input = schema.parse(await readJson(req));
    if (!(await verifyCaptcha(input.captchaToken, ip))) throw new DonationError("Bot check failed.", 403);
    const store = getStore();
    const c = await store.getCampaign();
    await store.createTeam({
      id: newId().slice(0, 8),
      campaignId: c.id,
      name: input.name,
      goalCents: input.goal ? Math.round(input.goal * 100) : null,
      message: input.message,
      ownerName: input.name,
      ownerEmail: input.email,
      ownerPhone: input.phone,
      // Real modes: an organizer approves teams before they get a public page. Demo mode (no real money):
      // go live immediately so the sign-up form visibly works without an admin login.
      approved: paymentsMode() === "demo",
      createdAt: nowIso(),
    });
    invalidateTotals();
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
