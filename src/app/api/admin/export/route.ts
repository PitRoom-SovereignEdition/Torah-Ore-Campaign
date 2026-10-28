import { getRole } from "@/lib/auth";
import { organizerSeesContact } from "@/lib/config";
import { audit } from "@/lib/audit";
import { getStore } from "@/lib/store";

const esc = (v: unknown) => {
  let s = String(v ?? "");
  // Neutralise spreadsheet formula injection from donor-supplied text.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Finance gets everything. Organizers get the same file with contact details removed unless the charity opted in. */
export async function GET() {
  const role = await getRole();
  if (!role) return new Response("Unauthorized", { status: 401 });
  const contact = role === "finance" || organizerSeesContact();
  const store = getStore();
  const [donations, teams] = await Promise.all([store.listDonations(), store.listTeams()]);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const cols = ["id","created_at","status","provider","demo","amount","currency","campaign_amount","refunded","dispute","review","team","display_name","anonymous","message","dedication","payment_ref","entered_by","verified_by",
    ...(contact ? ["donor_name","donor_email","reference","address","city","state","zip","country"] : [])];
  const rows = donations.map((d) => [
    d.id, d.createdAt, d.status, d.provider, d.isDemo, (d.amountCents / 100).toFixed(2), d.currency,
    (d.campaignAmountCents / 100).toFixed(2), (d.refundedCents / 100).toFixed(2), d.disputeState, d.reviewState,
    d.teamId ? (teamName.get(d.teamId) ?? d.teamId) : "", d.displayName, d.anonymous, d.message, d.dedication, d.paymentRef ?? "", d.enteredBy ?? "", d.verifiedBy ?? "",
    ...(contact ? [d.donorName, d.donorEmail, d.reference, d.address, d.city, d.state, d.zip, d.country] : []),
  ]);
  await audit(role, "export.csv", "donations", "all", { rows: rows.length, contact });
  const csv = [cols, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="donations-${new Date().toISOString().slice(0, 10)}${contact ? "" : "-no-contact"}.csv"`,
      "cache-control": "no-store",
    },
  });
}
