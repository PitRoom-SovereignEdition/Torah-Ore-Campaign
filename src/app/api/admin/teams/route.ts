import { z } from "zod";
import { handleError, json, readJson, requireAdminApi } from "@/lib/http";
import { getStore } from "@/lib/store";

const schema = z.object({
  id: z.string().min(1).max(64),
  approved: z.boolean().optional(),
  name: z.string().trim().min(1).max(120).optional(),
});

export async function POST(req: Request) {
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  try {
    const { id, ...patch } = schema.parse(await readJson(req));
    await getStore().updateTeam(id, patch);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
