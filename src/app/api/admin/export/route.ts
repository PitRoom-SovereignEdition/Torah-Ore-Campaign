import { isAdmin } from "@/lib/auth";
import { getStore } from "@/lib/store";

const esc = (v: unknown) => {
  let s = String(v ?? "");
  // Neutralise spreadsheet formula injection from donor-supplied text.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const store = getStore();
  const [donations, teams] = await Promise.all([store.listDonations(), store.listTeams()]);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const cols = ["id","created_at","status","provider","demo","amount","currency","campaign_amount","refunded","team","donor_name","donor_email","display_name","anonymous","reference","address","city","state","zip","country","message","dedication","payment_ref"];
  const rows = donations.map((d) => [
    d.id, d.createdAt, d.status, d.provider, d.isDemo, (d.amountCents / 100).toFixed(2), d.currency,
    (d.campaignAmountCents / 100).toFixed(2), (d.refundedCents / 100).toFixed(2),
    d.teamId ? (teamName.get(d.teamId) ?? d.teamId) : "", d.donorName, d.donorEmail, d.displayName, d.anonymous,
    d.reference, d.address, d.city, d.state, d.zip, d.country, d.message, d.dedication, d.paymentRef ?? "",
  ]);
  const csv = [cols, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="donations-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
