/**
 * npm run db:seed         → creates the first admin user + KPR labour hire contact (safe to re-run)
 * npm run db:demo         → also loads demo jobs, contacts and site records (for trying the app out)
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as s from "../src/db/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});
const db = drizzle(pool, { schema: s });
const token = (p = "") => p + randomBytes(18).toString("base64url");

const tz = process.env.APP_TIMEZONE || "Australia/Sydney";
const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
const day = (offset: number) => {
  const d = new Date(`${todayIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

async function base() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.users);
  if (n === 0) {
    const email = (process.env.ADMIN_EMAIL || "admin@sdlcreations.com.au").toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "change-me-now";
    await db.insert(s.users).values({
      name: process.env.ADMIN_NAME || "SDL Admin",
      email,
      role: "admin",
      passwordHash: await bcrypt.hash(password, 10),
    });
    console.log(`Admin user created: ${email}`);
  }
  const [kpr] = await db.select().from(s.contacts).where(eq(s.contacts.type, "labour_hire")).limit(1);
  if (!kpr) {
    await db.insert(s.contacts).values({ type: "labour_hire", name: "KPR Labour Hire", notes: "All SDL labour hire is booked through the office." });
    console.log("KPR labour hire contact created – add their email in Contacts.");
  }
}

async function demo() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.jobs);
  if (n > 0) {
    console.log("Jobs already exist – skipping demo data.");
    return;
  }
  const pw = await bcrypt.hash("sdl12345", 10);
  const [office, sup1, sup2] = await db
    .insert(s.users)
    .values([
      { name: "Olivia Office", email: "office@sdl.test", role: "office", passwordHash: pw, phone: "0400 111 222" },
      { name: "Sam Supervisor", email: "sam@sdl.test", role: "supervisor", passwordHash: pw, phone: "0400 333 444", hourlyRateCents: 6500 },
      { name: "Jordan Lee", email: "jordan@sdl.test", role: "supervisor", passwordHash: pw, phone: "0400 555 666", hourlyRateCents: 6000 },
    ])
    .returning();
  const [admin] = await db.select().from(s.users).where(eq(s.users.role, "admin")).limit(1);
  const [kpr] = await db.select().from(s.contacts).where(eq(s.contacts.type, "labour_hire")).limit(1);
  await db.update(s.contacts).set({ email: "bookings@kpr.test", phone: "07 3000 1000", contactName: "Kylie Booking" }).where(eq(s.contacts.id, kpr!.id));

  const subbies = await db
    .insert(s.contacts)
    .values([
      { type: "subcontractor", name: "Ground Up Earthworks", contactName: "Dave Miller", trade: "Earthworks", phone: "0411 000 001", email: "dave@groundup.test" },
      { type: "subcontractor", name: "Blue Lagoon Pools", contactName: "Mia Chen", trade: "Pool installation", phone: "0411 000 002", email: "mia@bluelagoon.test" },
      { type: "subcontractor", name: "Solid Base Concreting", contactName: "Tony Russo", trade: "Concrete & footings", phone: "0411 000 003", email: "tony@solidbase.test" },
      { type: "subcontractor", name: "Brickline Blocklayers", contactName: "Ben Walsh", trade: "Blockwork", phone: "0411 000 004", email: "ben@brickline.test" },
      { type: "subcontractor", name: "Smooth Finish Rendering", contactName: "Ana Lopez", trade: "Rendering", phone: "0411 000 005", email: "ana@smoothfinish.test" },
      { type: "subcontractor", name: "Coastal Tiling Co", contactName: "Luke Tran", trade: "Tiling & finishes", phone: "0411 000 006", email: "luke@coastaltiling.test" },
      { type: "subcontractor", name: "Clearview Glass Fencing", contactName: "Priya Nair", trade: "Pool fencing", phone: "0411 000 007", email: "priya@clearview.test" },
    ])
    .returning();
  const byTrade = (t: string) => subbies.find((x) => x.trade === t)!.id;
  const [supplier1, supplier2] = await db
    .insert(s.contacts)
    .values([
      { type: "supplier", name: "Landscape Supplies Direct", phone: "07 3000 2000", email: "orders@lsd.test" },
      { type: "supplier", name: "Turf Masters", phone: "07 3000 3000", email: "sales@turfmasters.test" },
    ])
    .returning();
  const clients = await db
    .insert(s.contacts)
    .values([
      { type: "client", name: "Rachel & Tom Bennett", contactName: "Rachel Bennett", phone: "0422 100 200", email: "rachel@bennett.test", address: "14 Wattle St, Carindale" },
      { type: "client", name: "Michael Nguyen", phone: "0422 300 400", email: "michael@nguyen.test", address: "8 Ocean View Dr, Wynnum" },
      { type: "client", name: "Sarah Collins", phone: "0422 500 600", email: "sarah@collins.test", address: "22 Ridge Rd, Bardon" },
      { type: "client", name: "The Patel Family", contactName: "Anil Patel", phone: "0422 700 800", email: "anil@patel.test", address: "5 Fig Tree Ct, Chapel Hill" },
      { type: "client", name: "Grace Kim", phone: "0422 900 000", email: "grace@kim.test", address: "31 Banksia Ave, Ascot" },
    ])
    .returning();

  const templates = [
    ["Demolition & site preparation", "sdl"],
    ["Earthworks", "subcontractor", "Earthworks"],
    ["Pool installation", "subcontractor", "Pool installation"],
    ["Concrete & footings", "subcontractor", "Concrete & footings"],
    ["Blockwork", "subcontractor", "Blockwork"],
    ["Rendering", "subcontractor", "Rendering"],
    ["Tiling & finishes", "subcontractor", "Tiling & finishes"],
    ["Pool details, fencing & associated works", "subcontractor", "Pool fencing"],
    ["Gardens, turf & clean-up", "sdl"],
  ] as const;

  // ── Active job: Bennett – mid way through ──
  const [bennett] = await db
    .insert(s.jobs)
    .values({
      name: "Bennett – Pool & backyard",
      clientId: clients[0]!.id,
      siteAddress: "14 Wattle St, Carindale",
      status: "in_progress",
      source: "Referral",
      description: "Fibreglass pool, block retaining walls, rendered feature wall, tiled pool surround, glass fencing, turf and gardens.",
      estimatedValueCents: 14500000,
      contractValueCents: 14250000,
      supervisorId: sup1!.id,
      startDate: day(-24),
      targetDate: day(30),
      siteInfo: "Access via side gate (code 4512). Dog in neighbouring yard. Assembly point: front driveway. First aid kit in SDL ute. Overhead power line on the north boundary.",
      inductionToken: token(),
    })
    .returning();

  const budgets = [850000, 1200000, 3800000, 1650000, 1400000, 900000, 1500000, 1100000, 950000];
  const offsets: [number, number][] = [[-24, -20], [-19, -16], [-15, -9], [-8, -4], [-3, 2], [3, 6], [7, 13], [14, 18], [19, 28]];
  const statuses = ["signed_off", "signed_off", "signed_off", "complete", "in_progress", "not_started", "not_started", "not_started", "not_started"];
  const bStages = await db
    .insert(s.stages)
    .values(
      templates.map((t, i) => ({
        jobId: bennett!.id,
        name: t[0],
        kind: t[1],
        sortOrder: i,
        contactId: t[1] === "subcontractor" ? byTrade(t[2]!) : null,
        startDate: day(offsets[i]![0]),
        endDate: day(offsets[i]![1]),
        status: statuses[i]!,
        budgetCents: budgets[i]!,
        completedAt: ["signed_off", "complete"].includes(statuses[i]!) ? hoursAgo(24 * (20 - i * 2)) : null,
        signedOffAt: statuses[i] === "signed_off" ? hoursAgo(24 * (19 - i * 2)) : null,
      })),
    )
    .returning();

  const scope: Record<number, string[]> = {
    0: ["Remove existing pavers and garden edging", "Demolish old shed slab", "Strip turf and topsoil from pool area", "Skip bin removal"],
    1: ["Excavate pool shell", "Cut and level for retaining wall footings", "Remove spoil from site"],
    2: ["Supply and install 8.5m fibreglass pool", "Plumbing and filtration install", "Backfill and pool bond beam"],
    3: ["Retaining wall footings", "Pool surround slab", "Feature wall footing"],
    4: ["Core-filled block retaining wall – 22 lm", "Feature wall – 4.2 lm", "Steps to upper lawn"],
    5: ["Render feature wall and retaining walls", "Paint finish – Dulux Lexicon Quarter"],
    6: ["Pool coping – travertine", "Surround tiling – 48 m²", "Step treads"],
    7: ["Frameless glass pool fencing – 18 lm", "Self-closing gate", "Pool heat pump install"],
    8: ["Garden beds and edging", "Plant out – per landscape plan", "Lay Sir Walter turf – 85 m²", "Final clean-up and handover"],
  };
  for (const [i, items] of Object.entries(scope)) {
    const st = bStages[Number(i)]!;
    await db.insert(s.scopeItems).values(
      items.map((d, k) => ({
        jobId: bennett!.id,
        stageId: st.id,
        description: d,
        sortOrder: k,
        doneAt: st.status === "signed_off" || st.status === "complete" || (st.status === "in_progress" && k === 0) ? hoursAgo(48) : null,
        doneById: sup1!.id,
      })),
    );
  }

  await db.insert(s.quotes).values({
    jobId: bennett!.id,
    title: "Quote – Bennett pool & backyard",
    status: "accepted",
    acceptedAt: hoursAgo(24 * 40),
    acceptedName: "Rachel Bennett",
    shareToken: token("q_"),
    createdById: office!.id,
  });

  await db.insert(s.contracts).values([
    { jobId: bennett!.id, kind: "client", contactId: clients[0]!.id, title: "Contract – Bennett pool & backyard", amountCents: 14250000, status: "signed", signedAt: hoursAgo(24 * 38), signedName: "Rachel Bennett", shareToken: token("c_") },
    ...bStages
      .filter((st) => st.kind === "subcontractor")
      .slice(0, 5)
      .map((st) => ({
        jobId: bennett!.id,
        kind: "subcontract",
        contactId: st.contactId,
        stageId: st.id,
        title: `${st.name} – Bennett pool & backyard`,
        amountCents: Math.round(st.budgetCents * 0.97),
        status: "signed",
        signedAt: hoursAgo(24 * 30),
        signedName: "Subcontractor",
        shareToken: token("c_"),
      })),
  ]);

  // Daily logs for the last few working days
  for (const [off, work, kprN] of [
    [-3, "Blockwork started on retaining wall. First 3 courses laid on north side.", 2],
    [-2, "Retaining wall up to 6 courses. Core fill booked for Thursday. Cleaned up spoil.", 2],
    [-1, "Feature wall footing inspected. Steps formed up for blocklayers.", 1],
  ] as const) {
    const [log] = await db
      .insert(s.dailyLogs)
      .values({ jobId: bennett!.id, date: day(off), authorId: sup1!.id, stageId: bStages[4]!.id, workCompleted: work, weather: "Fine", subbiesOnSite: "Brickline Blocklayers" })
      .returning();
    await db.insert(s.labourEntries).values([
      { jobId: bennett!.id, dailyLogId: log!.id, date: day(off), kind: "sdl", userId: sup1!.id, name: "Sam Supervisor", hours: 8 },
      ...Array.from({ length: kprN }, (_, k) => ({ jobId: bennett!.id, dailyLogId: log!.id, date: day(off), kind: "kpr", name: `KPR worker ${k + 1}`, hours: 7.5 })),
    ]);
  }
  await db.insert(s.entries).values([
    { jobId: bennett!.id, type: "issue", body: "Found old stormwater pipe running under the retaining wall line – needs to be relocated before core fill.", authorId: sup1!.id, createdAt: hoursAgo(20) },
    { jobId: bennett!.id, type: "client", body: "Rachel asked about adding LED strip lighting under the pool coping and two garden uplights.", authorId: sup1!.id, createdAt: hoursAgo(26) },
    { jobId: bennett!.id, type: "note", body: "Pool fence glass ordered – 3 week lead time.", authorId: office!.id, createdAt: hoursAgo(70) },
  ]);
  await db.insert(s.variations).values([
    { jobId: bennett!.id, number: 1, title: "Relocate stormwater pipe", description: "Old stormwater line under retaining wall footing needs relocating 1.2m east, incl. new pit.", source: "site", status: "identified", identifiedById: sup1!.id, shareToken: token("v_"), createdAt: hoursAgo(20) },
    { jobId: bennett!.id, number: 2, title: "LED strip lighting to pool coping", description: "Supply and install 9m LED strip under coping and 2 garden uplights incl. transformer.", source: "client", status: "submitted", costCents: 185000, priceCents: 265000, pricedAt: hoursAgo(10), submittedAt: hoursAgo(8), identifiedById: sup1!.id, shareToken: token("v_") },
    { jobId: bennett!.id, number: 3, title: "Extra 2 courses on retaining wall", description: "Client requested higher wall for privacy.", source: "client", status: "approved", costCents: 120000, priceCents: 168000, approvedAt: hoursAgo(24 * 6), approvedName: "Rachel Bennett", identifiedById: sup1!.id, shareToken: token("v_") },
  ]);
  await db.insert(s.bills).values([
    { jobId: bennett!.id, stageId: bStages[1]!.id, contactId: byTrade("Earthworks"), kind: "subcontractor", reference: "GU-2041", invoiceDate: day(-15), amountCents: 1164000, gstCents: 116400, status: "paid", approvedAt: hoursAgo(24 * 13), paidAt: hoursAgo(24 * 6) },
    { jobId: bennett!.id, stageId: bStages[2]!.id, contactId: byTrade("Pool installation"), kind: "subcontractor", reference: "BLP-889", invoiceDate: day(-8), amountCents: 3686000, gstCents: 368600, status: "approved", approvedAt: hoursAgo(24 * 5) },
    { jobId: bennett!.id, stageId: bStages[3]!.id, contactId: byTrade("Concrete & footings"), kind: "subcontractor", reference: "SB-1120", invoiceDate: day(-2), amountCents: 1600500, gstCents: 160050, status: "pending" },
    { jobId: bennett!.id, contactId: kpr!.id, kind: "labour_hire", reference: "KPR-55102", invoiceDate: day(-1), periodFrom: day(-7), periodTo: day(-1), hours: 45, amountCents: 247500, gstCents: 24750, status: "pending", description: "Labour hire – week ending " + day(-1) },
    { jobId: bennett!.id, contactId: supplier1!.id, kind: "supplier", reference: "LSD-7781", invoiceDate: day(-4), amountCents: 186000, gstCents: 18600, status: "pending", description: "Drainage aggregate and ag pipe" },
  ]);
  await db.insert(s.labourBookings).values([
    { jobId: bennett!.id, contactId: kpr!.id, stageId: bStages[4]!.id, date: day(1), days: 2, workers: 2, hours: 8, task: "Labourers for blockwork – mixing and core fill", status: "booked", requestedById: sup1!.id, bookedAt: hoursAgo(30), bookedById: office!.id },
    { jobId: bennett!.id, contactId: kpr!.id, stageId: bStages[8]!.id, date: day(19), days: 3, workers: 3, hours: 8, task: "Turf laying and garden planting", status: "requested", requestedById: sup1!.id },
  ]);
  await db.insert(s.tasks).values([
    { jobId: bennett!.id, title: "Get plumber quote to relocate stormwater", assigneeId: office!.id, dueDate: day(1), createdById: sup1!.id },
    { jobId: bennett!.id, title: "Confirm tile colour selection with Rachel", assigneeId: sup1!.id, dueDate: day(3), createdById: office!.id },
    { jobId: bennett!.id, title: "Order pool coping (travertine)", assigneeId: office!.id, dueDate: day(-1), createdById: office!.id },
  ]);
  await db.insert(s.inductions).values([
    { jobId: bennett!.id, name: "Ben Walsh", company: "Brickline Blocklayers", phone: "0411 000 004", whiteCard: "WC123456", answers: [], signatureData: "data:image/png;base64,", inductedById: sup1!.id, createdAt: hoursAgo(24 * 3) },
    { jobId: bennett!.id, name: "Chris Hall", company: "KPR Labour Hire", phone: "0433 111 999", whiteCard: "WC998877", answers: [], signatureData: "data:image/png;base64,", inductedById: sup1!.id, createdAt: hoursAgo(24 * 3) },
  ]);
  await db.insert(s.jobContacts).values([{ jobId: bennett!.id, contactId: supplier1!.id, role: "Drainage & aggregates" }, { jobId: bennett!.id, contactId: supplier2!.id, role: "Turf" }]);

  // ── Won job: Nguyen – starting soon ──
  const [nguyen] = await db
    .insert(s.jobs)
    .values({
      name: "Nguyen – Retaining & landscape",
      clientId: clients[1]!.id,
      siteAddress: "8 Ocean View Dr, Wynnum",
      status: "won",
      source: "Website",
      description: "Tiered block retaining walls, concrete steps, rendered walls, turf and gardens. No pool.",
      estimatedValueCents: 6800000,
      contractValueCents: 6650000,
      supervisorId: sup2!.id,
      startDate: day(5),
      targetDate: day(40),
      siteInfo: "Steep site – fall hazard at rear boundary. Park on street only.",
      inductionToken: token(),
    })
    .returning();
  await db.insert(s.stages).values(
    templates
      .filter((t) => !["Pool installation", "Pool details, fencing & associated works"].includes(t[0]))
      .map((t, i) => ({
        jobId: nguyen!.id,
        name: t[0],
        kind: t[1],
        sortOrder: i,
        contactId: t[1] === "subcontractor" ? byTrade(t[2]!) : null,
        startDate: day(5 + i * 5),
        endDate: day(8 + i * 5),
        budgetCents: [600000, 900000, 1100000, 1300000, 700000, 600000, 800000][i]!,
      })),
  );
  await db.insert(s.labourBookings).values({ jobId: nguyen!.id, contactId: kpr!.id, date: day(5), days: 3, workers: 2, hours: 8, task: "Demolition and site clean", status: "requested", requestedById: sup2!.id });

  // ── Leads ──
  const leads = [
    { name: "Collins – Pool & entertaining", client: clients[2]!, status: "quoted", value: 11800000, src: "Website" },
    { name: "Patel – Front yard makeover", client: clients[3]!, status: "site_visit", value: 3500000, src: "Referral" },
    { name: "Kim – Plunge pool & garden", client: clients[4]!, status: "enquiry", value: 7200000, src: "Social media" },
  ];
  for (const l of leads) {
    const [j] = await db
      .insert(s.jobs)
      .values({ name: l.name, clientId: l.client.id, siteAddress: l.client.address, status: l.status, source: l.src, estimatedValueCents: l.value, description: "Initial enquiry – see notes.", inductionToken: token() })
      .returning();
    await db.insert(s.stages).values(templates.map((t, i) => ({ jobId: j!.id, name: t[0], kind: t[1], sortOrder: i })));
    if (l.status === "quoted") {
      const [q] = await db
        .insert(s.quotes)
        .values({ jobId: j!.id, title: `Quote – ${l.name}`, status: "sent", sentAt: hoursAgo(72), validUntil: day(27), markupPct: 25, shareToken: token("q_"), createdById: office!.id, notes: "Prices exclude GST. Valid for 30 days." })
        .returning();
      const lines: [string, string, number, string, number][] = [
        ["Demolition & site preparation", "Demolition and site prep incl. skip bins", 1, "item", 720000],
        ["Earthworks", "Excavation for pool and walls", 1, "item", 1050000],
        ["Pool installation", "Supply & install 7.5m fibreglass pool", 1, "item", 3600000],
        ["Concrete & footings", "Footings and surround slab", 52, "m²", 28000],
        ["Blockwork", "Block retaining wall", 18, "lm", 72000],
        ["Rendering", "Render & paint walls", 1, "item", 780000],
        ["Tiling & finishes", "Pool surround tiling", 52, "m²", 24000],
        ["Pool details, fencing & associated works", "Glass pool fencing", 16, "lm", 55000],
        ["Gardens, turf & clean-up", "Turf, gardens and clean-up", 1, "item", 820000],
      ];
      await db.insert(s.quoteItems).values(
        lines.map(([section, description, qty, unit, cost], i) => ({ quoteId: q!.id, section, description, qty, unit, unitCostCents: cost, unitPriceCents: Math.round(cost * 1.25), sortOrder: i })),
      );
    }
    await db.insert(s.activity).values({ jobId: j!.id, userId: office!.id, kind: "job", message: `Enquiry created: ${l.name}`, createdAt: hoursAgo(96) });
  }
  await db.insert(s.tasks).values({ title: "Call Grace Kim to book site visit", assigneeId: admin!.id, dueDate: day(0), createdById: office!.id });

  const acts: [number, number, string, number][] = [
    [bennett!.id, sup1!.id, "Daily log for yesterday", 18],
    [bennett!.id, sup1!.id, "Concrete & footings marked complete – ready for office check", 22],
    [bennett!.id, sup1!.id, "Problem / issue: Found old stormwater pipe running under the retaining wall line", 20],
    [bennett!.id, sup1!.id, "Variation V1 identified: Relocate stormwater pipe", 20],
    [bennett!.id, office!.id, "Variation V2 sent", 8],
    [nguyen!.id, sup2!.id, "KPR labour requested: 2 workers for 3 days", 5],
  ];
  await db.insert(s.activity).values(acts.map(([jobId, userId, message, h]) => ({ jobId, userId, kind: "demo", message, createdAt: hoursAgo(h) })));

  console.log("Demo data loaded. Demo logins (password sdl12345): office@sdl.test, sam@sdl.test, jordan@sdl.test");
}

(async () => {
  await base();
  if (process.argv.includes("--demo")) await demo();
  await pool.end();
})().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
