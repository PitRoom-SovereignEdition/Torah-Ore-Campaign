import { siteUrl } from "./config";
import { formatMoney } from "./money";
import type { Campaign, Donation } from "./types";

/**
 * Donation confirmation email. Uses Resend if RESEND_API_KEY + MAIL_FROM are set, otherwise logs.
 * This is a confirmation, not a legal tax receipt: formal receipts must be arranged with the
 * yeshiva's own advisers. Put any required wording in Campaign → "Receipt footer".
 */
export async function sendConfirmation(c: Campaign, d: Donation): Promise<void> {
  if (!d.donorEmail) return;
  const amount = formatMoney(d.amountCents, d.currency);
  const subject = `Thank you for your gift to ${c.charityName}`;
  const text = [
    `Dear ${d.donorName || "friend"},`,
    ``,
    `Thank you for your ${d.isDemo ? "(DEMO) " : ""}gift of ${amount} to ${c.title}.`,
    `Reference: ${d.id}`,
    d.dedication ? `Dedication: ${d.dedication}` : "",
    ``,
    c.receiptFooter,
    c.charityRegNo ? `Registration no: ${c.charityRegNo}` : "",
    siteUrl(),
  ]
    .filter((l) => l !== "")
    .join("\n");

  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    console.log(`[mail:dry-run] to=${d.donorEmail} subject="${subject}"`);
    return;
  }
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: d.donorEmail, subject, text }),
    });
  } catch (e) {
    console.error("[mail] failed", e);
  }
}
