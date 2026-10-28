import { getWall, type WallSort } from "@/lib/donations";
import { handleError, json } from "@/lib/http";
import { getStore } from "@/lib/store";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const sortParam = u.searchParams.get("sort");
    const sort: WallSort = sortParam === "highest" || sortParam === "liked" ? sortParam : "latest";
    const offset = Math.max(0, Number(u.searchParams.get("offset") ?? 0) || 0);
    const limit = Math.min(60, Math.max(1, Number(u.searchParams.get("limit") ?? 12) || 12));
    const res = await getWall({
      campaign: await getStore().getCampaign(),
      sort,
      q: (u.searchParams.get("q") ?? "").slice(0, 80),
      teamId: u.searchParams.get("team"),
      offset,
      limit,
    });
    return json(res);
  } catch (e) {
    return handleError(e);
  }
}
