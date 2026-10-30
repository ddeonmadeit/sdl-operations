import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowDown, ArrowUp, HardHat, Pencil, Plus, Trash2 } from "lucide-react";
import { ActionButton, ActionForm, Modal, SubmitButton } from "@/components/client";
import { BookingFields } from "@/components/office/booking-fields";
import { SendDialog } from "@/components/send-dialog";
import { Badge, Card, cx, EmptyState, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { contacts, labourBookings, users } from "@/db/schema";
import { cancelBooking, requestBooking, updateBooking } from "@/lib/actions/labour";
import { addStage, deleteStage, moveStage, setStageStatus, updateStage } from "@/lib/actions/jobs";
import { sendDoc } from "@/lib/actions/send";
import { requireOffice } from "@/lib/auth";
import { BOOKING_STATUSES, STAGE_STATUSES } from "@/lib/constants";
import { emailEnabled } from "@/lib/email";
import { addDays, centsToInput, daysBetween, fmtDate, money, today, weekStart } from "@/lib/format";
import { docMessage } from "@/lib/messages";
import { contactOptions, getJob, jobStages } from "@/lib/queries";

type StageRow = Awaited<ReturnType<typeof jobStages>>[number];

function StageFields({ stage, subbies }: { stage?: StageRow; subbies: { id: number; name: string; trade: string | null }[] }) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">Stage</span>
        <input name="name" required defaultValue={stage?.name} className="input" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Who does it</span>
          <select name="kind" defaultValue={stage?.kind ?? "subcontractor"} className="input">
            <option value="subcontractor">Subcontractor</option>
            <option value="sdl">SDL supervisor + KPR</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Subcontractor</span>
          <select name="contactId" defaultValue={stage?.contactId ?? ""} className="input">
            <option value="">– None –</option>
            {subbies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.trade ? ` · ${s.trade}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Start</span>
          <input name="startDate" type="date" defaultValue={stage?.startDate ?? ""} className="input" />
        </label>
        <label className="block">
          <span className="label">Finish</span>
          <input name="endDate" type="date" defaultValue={stage?.endDate ?? ""} className="input" />
        </label>
      </div>
      <label className="block">
        <span className="label">Cost budget ($ ex GST)</span>
        <input name="budget" inputMode="decimal" defaultValue={centsToInput(stage?.budgetCents)} className="input" />
      </label>
      <label className="block">
        <span className="label">Notes</span>
        <textarea name="notes" rows={2} defaultValue={stage?.notes ?? ""} className="input" />
      </label>
    </div>
  );
}

export default async function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  await requireOffice();
  const { id } = await params;
  const job = await getJob(Number(id));
  const [stageRows, subbies, bookings] = await Promise.all([
    jobStages(job.id),
    contactOptions(["subcontractor"]),
    db
      .select({ b: labourBookings, contact: contacts.name, by: users.name })
      .from(labourBookings)
      .leftJoin(contacts, eq(contacts.id, labourBookings.contactId))
      .leftJoin(users, eq(users.id, labourBookings.requestedById))
      .where(and(eq(labourBookings.jobId, job.id)))
      .orderBy(desc(labourBookings.status), asc(labourBookings.date)),
  ]);
  const smtp = emailEnabled();
  const bookingMsgs = await Promise.all(bookings.map((b) => docMessage("booking", b.b.id)));

  // Simple Gantt range: from the earliest start to latest finish (or 8 weeks from today)
  const dated = stageRows.filter((s) => s.startDate);
  const t0 = today();
  const rangeStart = weekStart(dated.length ? dated.reduce((m, s) => (s.startDate! < m ? s.startDate! : m), dated[0]!.startDate!) : t0);
  const rangeEndRaw = dated.length ? dated.reduce((m, s) => ((s.endDate ?? s.startDate!) > m ? (s.endDate ?? s.startDate!) : m), t0) : addDays(t0, 56);
  const totalDays = Math.max(28, daysBetween(rangeStart, rangeEndRaw) + 7);
  const weeks = Math.ceil(totalDays / 7);
  const pctOf = (d: string) => (daysBetween(rangeStart, d) / (weeks * 7)) * 100;

  return (
    <div className="space-y-5">
      <Card
        title="Stages"
        pad={false}
        action={
          <Modal title="Add stage" trigger={<><Plus className="size-4" /> Stage</>} triggerClassName="btn btn-sm">
            <ActionForm action={addStage.bind(null, job.id)} success="Stage added">
              <StageFields subbies={subbies} />
              <SubmitButton className="btn-primary mt-4 w-full">Add stage</SubmitButton>
            </ActionForm>
          </Modal>
        }
      >
        {stageRows.length === 0 ? (
          <EmptyState title="No stages yet" />
        ) : (
          <ul className="divide-y divide-line">
            {stageRows.map((s, i) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap">
                <div className="flex flex-col">
                  <ActionButton action={moveStage.bind(null, s.id, "up")} className="btn-ghost h-5 w-6 p-0" title="Move up">
                    <ArrowUp className={cx("size-3.5", i === 0 && "opacity-20")} />
                  </ActionButton>
                  <ActionButton action={moveStage.bind(null, s.id, "down")} className="btn-ghost h-5 w-6 p-0" title="Move down">
                    <ArrowDown className={cx("size-3.5", i === stageRows.length - 1 && "opacity-20")} />
                  </ActionButton>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    {s.kind === "sdl" && <Badge tone="violet">SDL + KPR</Badge>}
                  </div>
                  <div className="text-xs text-muted">
                    {s.contact?.name ?? (s.kind === "sdl" ? "SDL supervisor" : <span className="text-amber-700">No subcontractor assigned</span>)}
                    {" · "}
                    {s.startDate ? `${fmtDate(s.startDate, { weekday: true })} → ${s.endDate ? fmtDate(s.endDate, { weekday: true }) : "?"}` : "Not scheduled"}
                    {s.budgetCents ? ` · Budget ${money(s.budgetCents, true)}` : ""}
                  </div>
                </div>
                <div className="flex w-full items-center gap-2 pl-9 sm:w-auto sm:pl-0">
                  <StatusBadge map={STAGE_STATUSES} value={s.status} />
                  <div className="flex-1 sm:hidden" />
                  {s.status === "complete" && (
                    <ActionButton action={setStageStatus.bind(null, s.id, "signed_off")} className="btn-sm btn-primary" success="Signed off">
                      Sign off
                    </ActionButton>
                  )}
                  {s.status === "not_started" && (
                    <ActionButton action={setStageStatus.bind(null, s.id, "in_progress")} className="btn-sm" success="Stage started">
                      Start
                    </ActionButton>
                  )}
                  {s.status === "in_progress" && (
                    <ActionButton action={setStageStatus.bind(null, s.id, "complete")} className="btn-sm" success="Marked complete">
                      Complete
                    </ActionButton>
                  )}
                  <Modal title={`Edit ${s.name}`} trigger={<Pencil className="size-4" />} triggerClassName="btn btn-ghost btn-icon btn-sm" triggerTitle="Edit stage">
                    <ActionForm action={updateStage.bind(null, s.id)} success="Stage saved" reset={false}>
                      <StageFields stage={s} subbies={subbies} />
                      <SubmitButton className="btn-primary mt-4 w-full">Save</SubmitButton>
                    </ActionForm>
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
                      {(["not_started", "in_progress", "complete", "signed_off"] as const)
                        .filter((st) => st !== s.status)
                        .map((st) => (
                          <ActionButton key={st} action={setStageStatus.bind(null, s.id, st)} className="btn-sm" success="Status changed">
                            Set: {STAGE_STATUSES[st].label}
                          </ActionButton>
                        ))}
                      <ActionButton action={deleteStage.bind(null, s.id)} confirm={`Delete the ${s.name} stage?`} className="btn-sm btn-ghost btn-danger">
                        <Trash2 className="size-4" /> Delete
                      </ActionButton>
                    </div>
                  </Modal>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {dated.length > 0 && (
        <Card title="Timeline" pad={false}>
          <div className="overflow-x-auto">
            <div className="min-w-[720px] p-4">
              <div className="relative ml-44 flex border-b border-line pb-1 text-[0.68rem] text-muted">
                {Array.from({ length: weeks }, (_, w) => (
                  <div key={w} className="flex-1 border-l border-line pl-1">
                    {fmtDate(addDays(rangeStart, w * 7))}
                  </div>
                ))}
              </div>
              <div className="relative">
                {t0 >= rangeStart && (
                  <div className="pointer-events-none absolute top-0 bottom-0 z-10 ml-44 w-[calc(100%-11rem)]">
                    <div className="absolute top-0 bottom-0 w-px bg-red-500" style={{ left: `${pctOf(t0)}%` }} />
                  </div>
                )}
                {stageRows.map((s) => (
                  <div key={s.id} className="flex items-center py-1">
                    <div className="w-44 shrink-0 truncate pr-3 text-xs font-medium">{s.name}</div>
                    <div className="relative h-6 flex-1 rounded bg-subtle/60">
                      {s.startDate && (
                        <div
                          className={cx(
                            "absolute top-0.5 bottom-0.5 rounded px-1.5 text-[0.65rem] leading-5 font-semibold text-white truncate",
                            s.status === "signed_off" ? "bg-green-600" : s.status === "complete" ? "bg-amber-500" : s.status === "in_progress" ? "bg-blue-600" : s.kind === "sdl" ? "bg-violet-500" : "bg-slate-400",
                          )}
                          style={{
                            left: `${pctOf(s.startDate)}%`,
                            width: `${Math.max(1.5, ((daysBetween(s.startDate, s.endDate ?? s.startDate) + 1) / (weeks * 7)) * 100)}%`,
                          }}
                          title={`${s.name}: ${fmtDate(s.startDate)} – ${fmtDate(s.endDate ?? s.startDate)}`}
                        >
                          {s.contact?.name ?? ""}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card
        title="KPR labour hire"
        pad={false}
        action={
          <Modal title="Book KPR labour" trigger={<><HardHat className="size-4" /> Book labour</>} triggerClassName="btn btn-sm">
            <ActionForm action={requestBooking.bind(null, job.id)} success="Booking added – send the order to KPR to confirm">
              <BookingFields stages={stageRows} />
              <SubmitButton className="btn-primary mt-4 w-full">Add booking</SubmitButton>
            </ActionForm>
          </Modal>
        }
      >
        {bookings.length === 0 ? (
          <EmptyState title="No labour booked">Supervisors request KPR labour from the site app – requests show here for the office to book.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {bookings.map(({ b, by }, i) => (
              <li key={b.id} className={cx("flex flex-wrap items-center gap-3 px-4 py-3", b.status === "cancelled" && "opacity-50")}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    PO-{b.id} · {b.workers} worker{b.workers > 1 ? "s" : ""} × {b.hours}h
                    {b.days > 1 ? ` × ${b.days} days` : ""} · {fmtDate(b.date, { weekday: true })}
                    {b.days > 1 ? ` – ${fmtDate(addDays(b.date, b.days - 1), { weekday: true })}` : ""}
                  </div>
                  <div className="text-xs text-muted">
                    {b.task || "General labour"} · start {b.startTime} · requested by {by ?? "office"}
                  </div>
                </div>
                <StatusBadge map={BOOKING_STATUSES} value={b.status} />
                {b.status === "requested" && bookingMsgs[i] && (
                  <SendDialog
                    title={`Send order PO-${b.id} to KPR`}
                    trigger="Book with KPR"
                    triggerClassName="btn btn-sm btn-primary"
                    message={bookingMsgs[i]!}
                    smtp={smtp}
                    action={sendDoc.bind(null, "booking", b.id)}
                    manualLabel="Booked by phone – mark booked"
                  />
                )}
                {b.status !== "cancelled" && (
                  <Modal title={`Edit PO-${b.id}`} trigger={<Pencil className="size-4" />} triggerClassName="btn btn-ghost btn-icon btn-sm" triggerTitle="Edit booking">
                    <ActionForm action={updateBooking.bind(null, b.id)} reset={false}>
                      <BookingFields stages={stageRows} booking={b} />
                      <SubmitButton className="btn-primary mt-4 w-full">Save</SubmitButton>
                    </ActionForm>
                    <ActionButton action={cancelBooking.bind(null, b.id)} confirm="Cancel this booking? Let KPR know if it was already confirmed." className="btn-ghost btn-danger mt-2 w-full">
                      Cancel booking
                    </ActionButton>
                  </Modal>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
