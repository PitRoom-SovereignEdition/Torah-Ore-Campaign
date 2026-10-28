import { randomUUID, createHash } from "node:crypto";

export const newId = () => randomUUID();
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const nowIso = () => new Date().toISOString();
