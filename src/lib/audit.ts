import { newId, nowIso } from "./ids";
import { getStore } from "./store";

/** Append-only log of who changed what, when and why. Never throws into the caller's flow. */
export async function audit(actor: string, action: string, targetType: string, targetId: string, detail: Record<string, unknown> = {}): Promise<void> {
  try {
    await getStore().appendAudit({ id: newId(), at: nowIso(), actor, action, targetType, targetId, detail });
  } catch (e) {
    console.error("[audit] failed to write", action, e);
  }
}
