import "server-only";
import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { files, jobs, users, variations } from "@/db/schema";
import { emailEnabled } from "./email";
import { docMessage } from "./messages";
import { getXeroConnection } from "./settings";
import { xeroConfigured } from "./xero";

/** Everything the variation cards need: rows, photos, prefilled send messages, Xero state. */
export async function loadVariations(where?: SQL) {
  const rows = await db
    .select({ v: variations, job: { id: jobs.id, name: jobs.name }, identifiedBy: users.name })
    .from(variations)
    .innerJoin(jobs, eq(jobs.id, variations.jobId))
    .leftJoin(users, eq(users.id, variations.identifiedById))
    .where(where)
    .orderBy(desc(variations.createdAt));
  const ids = rows.map((r) => r.v.id);
  const [photos, messages, conn] = await Promise.all([
    ids.length
      ? db
          .select({ id: files.id, name: files.name, mimeType: files.mimeType, ownerId: files.ownerId })
          .from(files)
          .where(and(eq(files.ownerType, "variation"), inArray(files.ownerId, ids)))
      : Promise.resolve([]),
    Promise.all(rows.map((r) => (["priced", "submitted"].includes(r.v.status) ? docMessage("variation", r.v.id) : null))),
    getXeroConnection(),
  ]);
  return {
    rows: rows.map((r, i) => ({ ...r, photos: photos.filter((p) => p.ownerId === r.v.id), message: messages[i] ?? null })),
    smtp: emailEnabled(),
    xero: xeroConfigured() && !!conn,
  };
}
