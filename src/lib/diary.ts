import "server-only";
import { and, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { db } from "@/db";
import { dailyLogs, entries, files, inductions, labourEntries, scopeItems, stages, users } from "@/db/schema";
import { isoDay } from "./format";

export type DiaryItem =
  | {
      kind: "log";
      at: Date;
      id: number;
      date: string;
      author: string | null;
      authorId: number;
      stage: string | null;
      workCompleted: string | null;
      weather: string | null;
      subbiesOnSite: string | null;
      labour: { kind: string; name: string; hours: number }[];
      notes: { id: number; type: string; body: string; resolvedAt: Date | null }[];
      photos: { id: number; name: string; mimeType: string }[];
    }
  | {
      kind: "entry";
      at: Date;
      id: number;
      type: string;
      body: string;
      author: string | null;
      authorId: number | null;
      resolvedAt: Date | null;
      variationId: number | null;
      photos: { id: number; name: string; mimeType: string }[];
    }
  | {
      kind: "done";
      at: Date;
      id: string;
      text: string;
      items: string[];
      by: string | null;
    }
  | {
      kind: "induction";
      at: Date;
      id: number;
      name: string;
      company: string | null;
      selfSigned: boolean;
      by: string | null;
    };

/** Combined job diary: daily logs (with their labour, notes and photos), notes, and inductions – newest first. */
export async function loadDiary(jobId: number, filter?: string, limit = 60): Promise<DiaryItem[]> {
  const wantLogs = !filter || filter === "log";
  const wantInductions = !filter || filter === "induction";
  const wantDone = !filter || filter === "done";
  const entryTypes = !filter ? null : filter === "photo" ? ["photo", "note", "client", "issue", "unforeseen"] : [filter];

  const [logs, ents, inds] = await Promise.all([
    wantLogs
      ? db
          .select({ log: dailyLogs, author: users.name, stage: stages.name })
          .from(dailyLogs)
          .leftJoin(users, eq(users.id, dailyLogs.authorId))
          .leftJoin(stages, eq(stages.id, dailyLogs.stageId))
          .where(eq(dailyLogs.jobId, jobId))
          .orderBy(desc(dailyLogs.date))
          .limit(limit)
      : Promise.resolve([]),
    filter === "log" || filter === "induction" || filter === "done"
      ? Promise.resolve([])
      : db
          .select({ e: entries, author: users.name })
          .from(entries)
          .leftJoin(users, eq(users.id, entries.authorId))
          .where(and(eq(entries.jobId, jobId), entryTypes ? inArray(entries.type, entryTypes) : undefined))
          .orderBy(desc(entries.createdAt))
          .limit(limit * 2),
    wantInductions
      ? db
          .select({ i: inductions, by: users.name })
          .from(inductions)
          .leftJoin(users, eq(users.id, inductions.inductedById))
          .where(eq(inductions.jobId, jobId))
          .orderBy(desc(inductions.createdAt))
          .limit(limit)
      : Promise.resolve([]),
  ]);

  // Completed work for the timeline: scope items ticked off and stages finished.
  const [doneScope, doneStages] = wantDone
    ? await Promise.all([
        db
          .select({ description: scopeItems.description, doneAt: scopeItems.doneAt, by: users.name, byId: scopeItems.doneById })
          .from(scopeItems)
          .leftJoin(users, eq(users.id, scopeItems.doneById))
          .where(and(eq(scopeItems.jobId, jobId), isNotNull(scopeItems.doneAt)))
          .orderBy(desc(scopeItems.doneAt))
          .limit(limit * 3),
        db
          .select({ id: stages.id, name: stages.name, completedAt: stages.completedAt, signedOffAt: stages.signedOffAt, by: users.name })
          .from(stages)
          .leftJoin(users, eq(users.id, stages.completedById))
          .where(and(eq(stages.jobId, jobId), or(isNotNull(stages.completedAt), isNotNull(stages.signedOffAt)))),
      ])
    : [[], []];

  const logIds = logs.map((l) => l.log.id);
  const entryIds = ents.map((e) => e.e.id);
  const [labour, fileRows] = await Promise.all([
    logIds.length ? db.select().from(labourEntries).where(inArray(labourEntries.dailyLogId, logIds)) : Promise.resolve([]),
    logIds.length || entryIds.length
      ? db
          .select({ id: files.id, name: files.name, mimeType: files.mimeType, ownerType: files.ownerType, ownerId: files.ownerId })
          .from(files)
          .where(
            and(
              eq(files.jobId, jobId),
              inArray(files.ownerType, ["log", "entry"]),
              inArray(files.ownerId, [...logIds, ...entryIds, -1]),
            ),
          )
      : Promise.resolve([]),
  ]);

  const items: DiaryItem[] = [];
  for (const { log, author, stage } of logs) {
    items.push({
      kind: "log",
      at: log.updatedAt,
      id: log.id,
      date: log.date,
      author,
      authorId: log.authorId,
      stage,
      workCompleted: log.workCompleted,
      weather: log.weather,
      subbiesOnSite: log.subbiesOnSite,
      labour: labour.filter((l) => l.dailyLogId === log.id).map((l) => ({ kind: l.kind, name: l.name, hours: l.hours })),
      notes: ents
        .filter((e) => e.e.dailyLogId === log.id)
        .map((e) => ({ id: e.e.id, type: e.e.type, body: e.e.body, resolvedAt: e.e.resolvedAt })),
      photos: fileRows.filter((f) => f.ownerType === "log" && f.ownerId === log.id),
    });
  }
  for (const { e, author } of ents) {
    if (e.dailyLogId && logIds.includes(e.dailyLogId)) continue; // shown inside its daily log
    const photos = fileRows.filter((f) => f.ownerType === "entry" && f.ownerId === e.id);
    if (filter === "photo" && !photos.length) continue;
    items.push({
      kind: "entry",
      at: e.createdAt,
      id: e.id,
      type: e.type,
      body: e.body,
      author,
      authorId: e.authorId,
      resolvedAt: e.resolvedAt,
      variationId: e.variationId,
      photos,
    });
  }
  for (const { i, by } of inds) {
    items.push({ kind: "induction", at: i.createdAt, id: i.id, name: i.name, company: i.company, selfSigned: i.selfSigned, by });
  }
  // Group ticked-off scope items by person and day, so a busy day reads as one line.
  const groups = new Map<string, { at: Date; by: string | null; items: string[] }>();
  for (const d of doneScope) {
    const key = `${d.byId ?? 0}|${isoDay(d.doneAt!)}`;
    const g = groups.get(key) ?? { at: d.doneAt!, by: d.by, items: [] };
    g.items.push(d.description);
    groups.set(key, g);
  }
  for (const [key, g] of groups) {
    items.push({ kind: "done", at: g.at, id: `s${key}`, by: g.by, items: g.items, text: `Completed ${g.items.length} scope item${g.items.length > 1 ? "s" : ""}` });
  }
  for (const st of doneStages) {
    if (st.completedAt) items.push({ kind: "done", at: st.completedAt, id: `c${st.id}`, by: st.by, items: [], text: `${st.name} marked complete on site` });
    if (st.signedOffAt) items.push({ kind: "done", at: st.signedOffAt, id: `o${st.id}`, by: null, items: [], text: `${st.name} checked and signed off by the office` });
  }

  // Daily logs sort by their date (end of that day) so they sit with that day's notes.
  const sortKey = (x: DiaryItem) => (x.kind === "log" ? Math.max(new Date(`${x.date}T23:59:00`).getTime() - 86_400_000 / 2, 0) : x.at.getTime());
  return items.sort((a, b) => sortKey(b) - sortKey(a)).slice(0, limit * 2);
}
