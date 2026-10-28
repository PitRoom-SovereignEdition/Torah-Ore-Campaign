import { notFound } from "next/navigation";
import { CampaignView } from "@/components/CampaignView";
import { getStore } from "@/lib/store";

export default async function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const team = await getStore().getTeam(teamId);
  if (!team || !team.approved) notFound();
  // Never pass private owner contact fields to the render tree.
  return <CampaignView team={{ ...team, ownerEmail: "", ownerPhone: "" }} />;
}
