import { z } from "zod";
import { audit } from "@/lib/audit";
import { handleError, json, readJson, requireRole } from "@/lib/http";
import { getStore } from "@/lib/store";

const schema = z.object({
  id: z.string().min(1).max(64),
  approved: z.boolean().optional(),
  name: z.string().trim().min(1).max(120).optional(),
});

export async function POST(req: Request) {
  const auth = await requireRole(req, ["organizer"]);
  if ("denied" in auth) return auth.denied;
  try {
    const { id, ...patch } = schema.parse(await readJson(req));
    await getStore().updateTeam(id, patch);
    await audit(auth.role, "team.update", "team", id, patch);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
