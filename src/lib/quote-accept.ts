import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, quoteItems, quotes, scopeItems, stages } from "@/db/schema";
import { logActivity } from "@/lib/activity";

/**
 * Accepting a quote:
 *  - sets the job's contract value to the quote total
 *  - sets each stage's cost budget from the quote lines in that section (creating stages for new sections)
 *  - turns quote lines into scope-of-works items for the site (if the stage has no scope yet)
 *  - moves the job to "Won"
 */
export async function applyAcceptedQuote(
  quoteId: number,
  opts: { userId?: number; acceptedName?: string; signatureData?: string },
) {
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId));
  if (!quote) throw new Error("Quote not found");
  const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, quoteId)).orderBy(asc(quoteItems.sortOrder));
  const jobStages = await db.select().from(stages).where(eq(stages.jobId, quote.jobId)).orderBy(asc(stages.sortOrder));
  const existingScope = await db.select({ stageId: scopeItems.stageId }).from(scopeItems).where(eq(scopeItems.jobId, quote.jobId));
  const stagesWithScope = new Set(existingScope.map((s) => s.stageId));

  const sellTotal = items.reduce((s, i) => s + Math.round(i.qty * i.unitPriceCents), 0);
  const bySection = new Map<string, typeof items>();
  for (const i of items) {
    const key = i.section.trim() || "General";
    bySection.set(key, [...(bySection.get(key) ?? []), i]);
  }

  await db.transaction(async (tx) => {
    let order = jobStages.length;
    for (const [section, list] of bySection) {
      const budget = list.reduce((s, i) => s + Math.round(i.qty * i.unitCostCents), 0);
      let stage = jobStages.find((s) => s.name.toLowerCase() === section.toLowerCase());
      if (!stage) {
        const [created] = await tx
          .insert(stages)
          .values({ jobId: quote.jobId, name: section, kind: "subcontractor", sortOrder: order++ })
          .returning();
        stage = created!;
      }
      await tx.update(stages).set({ budgetCents: budget }).where(eq(stages.id, stage.id));
      if (!stagesWithScope.has(stage.id)) {
        await tx.insert(scopeItems).values(
          list.map((i, idx) => ({
            jobId: quote.jobId,
            stageId: stage!.id,
            description: i.qty !== 1 || i.unit !== "item" ? `${i.description} (${i.qty} ${i.unit})` : i.description,
            sortOrder: idx,
          })),
        );
      }
    }
    await tx
      .update(quotes)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        acceptedName: opts.acceptedName ?? null,
        signatureData: opts.signatureData ?? null,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, quoteId));
    await tx
      .update(jobs)
      .set({ status: "won", contractValueCents: sellTotal, updatedAt: new Date() })
      .where(eq(jobs.id, quote.jobId));
  });

  await logActivity({
    jobId: quote.jobId,
    userId: opts.userId,
    kind: "quote",
    message: opts.acceptedName ? `Quote Q${quote.id} accepted online by ${opts.acceptedName}` : `Quote Q${quote.id} accepted`,
  });
}
