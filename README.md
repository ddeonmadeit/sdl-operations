# SDL Operations

Office dashboard/CRM and on-site app for **SDL Creations**. Both install on a phone like a normal app.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ddeonmadeit/sdl-operations)

**Test it online (free):** click the button above, sign in to Render with GitHub, enter an admin email and password (8+ characters), and click **Deploy Blueprint**. After a few minutes you get a link like `https://sdl-operations.onrender.com`. It **redeploys automatically every time this branch changes**.
- Sign in with your admin email and password. Demo logins `office@sdl.test` (office) and `sam@sdl.test` (supervisor) use the same password.
- Free plan limits: the site sleeps after 15 minutes idle (the first visit takes about a minute to wake), and the free database expires after 30 days. Upgrade the database to keep your data.

| App | URL | Who | Installs as |
| --- | --- | --- | --- |
| **Office** | `/office` | Admin and office staff | "SDL Office" |
| **Site** | `/site` | Supervisors (office staff can open it too) | "SDL Site" |
| Client / subbie links | `/p/…` | Clients and subcontractors, no login | – |
| Worker induction | `/induct/…` | Workers scan a QR code on site, no login | – |

Supervisors can only open the site app. Admin and office users can open both.

---

## What it covers

### Office

| Need | Where |
| --- | --- |
| Track enquiries → status → completion | **Jobs**: Leads (Enquiry, Site visit, Quoting, Quote sent), Active (Won, In progress), Completed, Lost. Each job has a status picker. |
| Estimates and quotes | Job → **Quotes & contracts**. Line items are grouped by stage, with cost, sell, markup and margin. Clients accept and sign online. An accepted quote sets the contract value and each stage's budget, and fills in the site **scope of works**. |
| Client contracts and subcontractor agreements | Job → **Quotes & contracts**. The template text is filled in from the job/stage, then sent for online signing. Edit templates in Settings → Templates. |
| Schedule work, coordinate subbies, book labour | Job → **Schedule & labour**: stages with dates, subbie, budget, status and a timeline. **Send dates** emails or texts each subbie their dates, the site address, supervisor, access notes and scope, and flags when dates change after sending. **Schedule** shows every job over two weeks. KPR requests from site become purchase orders (PO-#) that are emailed to KPR. |
| Variations: identified → priced → approved → invoiced | **Variations** (all jobs) and Job → Variations. Variations come from site, from client conversations, or from the office. Clients approve by signing online. Invoice in Xero, or record the invoice number. |
| Check work, hours and invoices before payment | **Approvals**: invoices from KPR, subcontractors and suppliers, with automatic checks (stage signed off? scope ticked? billed vs agreement? KPR hours billed vs hours logged on site?). Also covers SDL supervisor hours (weekly timesheets), completed work to sign off, and labour requests. |
| Costs and margins, Xero | Job → **Costs**: budget, committed, actual and waiting per stage, plus forecast margin and KPR/SDL hours. The dashboard shows margins across all active jobs. Settings → **Xero** connects the accounts. |

The **Dashboard** splits work into *incoming from site* (completed stages, new variations, problems, labour requests) and *to confirm for payment* (KPR, subcontractors, suppliers, SDL hours). It also shows your tasks, the next two weeks of schedule, job margins and recent activity.

### Site

| Need | Where |
| --- | --- |
| Scope, plans, schedule and contacts | Job → Scope of works (tick items off, mark a stage complete), Plans & documents, **Contracts & agreements** (what was agreed with the client and each subbie; supervisors don't see prices), Schedule & labour, Contacts (tap to call or text). |
| Signed site inductions | Job → **Induct a worker**. The worker signs on the supervisor's phone, or scans the **Worker QR** to sign on their own. The induction register is in the office under Site diary → Inductions. |
| Daily log | Job → **Daily log**: work completed, my hours (SDL), KPR workers and hours (prefilled from today's booking), subbies on site, weather, problems, unforeseen items and photos. Unsent text is kept on the phone. |
| Client discussions and potential variations | **Client conversation** (one tick flags it as a variation) and **Potential variation**. |
| Follow-up tasks | **Follow-up task**: a responsible person and due date. The office sees it straight away. |
| Labour hire | **Request KPR labour**. The office books it and the supervisor sees it confirmed. |

Photos are shrunk on the phone before uploading. If signal drops, a banner shows and saves are sent automatically when it comes back.

---

## Run it locally

Needs Node 20.9+ and PostgreSQL.

```bash
cp .env.example .env          # set DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npm run db:migrate            # creates tables + your admin login + KPR contact
npm run db:demo               # optional: demo jobs (logins office@sdl.test / sam@sdl.test, password sdl12345)
npm run dev                   # http://localhost:3000
```

To remove the demo data later, start with an empty database and run `npm run db:migrate` again.

## Put it online

The app is a standard Next.js server with a PostgreSQL database. The simplest options:

**Railway or Render** (recommended: no server to look after)
1. Create a project from this GitHub repo and add a PostgreSQL database.
2. Set the variables: `DATABASE_URL` (from the database), `APP_URL` (your public URL), `APP_TIMEZONE` (e.g. `Australia/Brisbane`), `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
3. Build command: `npm run build`. Start command: `npm run start:prod`. This runs migrations and creates the admin login on first start.
4. Photo storage: either attach a persistent disk/volume and set `UPLOAD_DIR` to it, or use an S3-compatible bucket (see below).

**Your own server (Docker)**
```bash
cp .env.example .env   # fill in APP_URL, ADMIN_EMAIL, ADMIN_PASSWORD, DB_PASSWORD
docker compose up -d
```
Put it behind HTTPS (e.g. Caddy or Cloudflare). Phones only install apps from HTTPS sites.

**Vercel**: works, but its disk isn't permanent, so set the `S3_*` variables for photos and plans and use a hosted Postgres (Neon or Supabase).

### File storage
Uploads go to `./uploads` (or `UPLOAD_DIR`) by default. On hosts with no permanent disk (like Render's free plan), set `FILE_STORAGE=database` to keep them in Postgres. For cloud storage, set `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`. This works with Cloudflare R2, AWS S3, Backblaze B2 and Supabase Storage.

### Email (optional)
Without email set up, every "Send" button opens your own email app with the message filled in, or you can copy the link. To send directly from the app, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `EMAIL_FROM` (Microsoft 365, Google Workspace or any SMTP service).

### Xero
1. At [developer.xero.com](https://developer.xero.com/app/manage), create a **Web app**.
2. Set the redirect URI to `<APP_URL>/api/xero/callback`.
3. Set `XERO_CLIENT_ID` and `XERO_CLIENT_SECRET`, restart, then go to **Settings → Xero → Connect Xero**.
4. Set your account codes (job costs and sales) and, optionally, a tracking category for jobs.

What syncs:
- Approved invoices are sent to Xero as **bills** (draft or awaiting payment; you choose).
- Approved variations become **draft client invoices**.
- "Sync paid from Xero" (Approvals → History) marks bills as paid.

Xero apps created after March 2026 must use granular scopes. The default `XERO_SCOPES` already does. Change it only if Xero rejects the connection.

### Installing on phones
Open `https://<your-site>/site` (supervisors) or `/office`:
- **iPhone:** Share, then Add to Home Screen.
- **Android:** ⋮, then Install app.

Logins last 60 days, so people rarely need to sign in again.

---

## Settings to fill in first
1. **Settings → Company**: name, ABN, licence, phone and email. These are shown on quotes and contracts.
2. **Settings → Team**: add office staff and supervisors, with each supervisor's hourly cost.
3. **Settings → Rates**: KPR hourly rate, used to check KPR invoices.
4. **Settings → Templates**: paste in your subcontractor agreement, client contract terms, quote terms and induction checklist.
5. **Contacts**: add KPR's booking email, your subbies (with trade) and suppliers.

## Project layout
```
src/app/office/*      office app pages
src/app/site/*        site app pages
src/app/p, induct     public signing + induction pages
src/lib/actions/*     everything that changes data (server actions)
src/lib/queries.ts    shared reads + job cost/margin calculation
src/lib/xero.ts       Xero integration
src/db/schema.ts      database tables
src/app/globals.css   design tokens (colours, radius) – restyle from here
public/brand/         SDL logo files (vector, in brand colours)
```

## Brand
The app uses only the four SDL brand colours: clay `#9B5D40`, dark olive `#404232`, cream `#E7DED3` and leaf olive `#5E622C`. Borders, muted text and soft backgrounds are mixes of these. They're all defined at the top of `src/app/globals.css`. App icons and the favicon are made from `public/brand/logo-mark-cream.svg` with `npm run icons`.

`npm run typecheck` checks the code. `npm run db:generate` creates a migration after changing `schema.ts`.
