import { asc } from "drizzle-orm";
import { CheckCircle2, Plus } from "lucide-react";
import { ActionButton, ActionForm, Modal, SubmitButton } from "@/components/client";
import { Avatar, Badge, Card, PageHeader, Tabs } from "@/components/ui";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import {
  changeMyPassword,
  createUser,
  disconnectXero,
  saveCompany,
  saveRates,
  saveTemplates,
  saveXeroSettings,
  updateUser,
} from "@/lib/actions/admin";
import { requireOffice } from "@/lib/auth";
import { ROLES, type Role } from "@/lib/constants";
import { appUrl, emailEnabled } from "@/lib/email";
import { centsToInput, fmtDateTime } from "@/lib/format";
import { getSettings, getXeroConnection } from "@/lib/settings";
import { xeroConfigured, xeroRedirectUri } from "@/lib/xero";

export const metadata = { title: "Settings" };

const TABS = { company: "Company", team: "Team", rates: "Rates", templates: "Templates", xero: "Xero", account: "My account" } as const;
type Tab = keyof typeof TABS;

function UserFields({ u }: { u?: User }) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">Name</span>
        <input name="name" required defaultValue={u?.name} className="input" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Email (login)</span>
          <input name="email" type="email" required defaultValue={u?.email} className="input" />
        </label>
        <label className="block">
          <span className="label">Phone</span>
          <input name="phone" type="tel" defaultValue={u?.phone ?? ""} className="input" />
        </label>
        <label className="block">
          <span className="label">Role</span>
          <select name="role" defaultValue={u?.role ?? "supervisor"} className="input">
            {Object.entries(ROLES).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Hourly cost ($)</span>
          <input name="hourlyRate" inputMode="decimal" defaultValue={centsToInput(u?.hourlyRateCents)} className="input" placeholder="Supervisors" />
        </label>
      </div>
      <label className="block">
        <span className="label">{u ? "New password (leave blank to keep)" : "Password"}</span>
        <input name="password" type="text" minLength={8} required={!u} className="input" autoComplete="new-password" />
      </label>
      {u && (
        <label className="flex items-center gap-2 text-sm">
          <input type="hidden" name="active" value="off" />
          <input type="checkbox" name="active" value="on" defaultChecked={u.active} className="size-4 accent-[var(--color-accent)]" /> Can sign in
        </label>
      )}
      <p className="hint">Admin: everything incl. team & Xero. Office: office + site apps. Supervisor: site app only.</p>
    </div>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; xero?: string }> }) {
  const me = await requireOffice();
  const sp = await searchParams;
  const tab: Tab = sp.tab && sp.tab in TABS ? (sp.tab as Tab) : "company";
  const s = await getSettings(["company", "rates", "templates", "xero"]);
  const isAdmin = me.role === "admin";

  return (
    <>
      <PageHeader title="Settings" />
      <Tabs current={`/office/settings?tab=${tab}`} tabs={(Object.keys(TABS) as Tab[]).map((t) => ({ href: `/office/settings?tab=${t}`, label: TABS[t] }))} />

      {tab === "company" && (
        <Card className="max-w-2xl">
          <ActionForm action={saveCompany} reset={false}>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["name", "Business name"],
                  ["abn", "ABN"],
                  ["phone", "Phone"],
                  ["email", "Email (replies go here)"],
                  ["licence", "Licence number"],
                  ["address", "Address"],
                ] as const
              ).map(([k, l]) => (
                <label key={k} className="block">
                  <span className="label">{l}</span>
                  <input name={k} defaultValue={s.company[k]} className="input" />
                </label>
              ))}
            </div>
            <p className="hint mt-3">Shown on quotes, contracts and emails.</p>
            <SubmitButton className="btn-primary mt-4">Save</SubmitButton>
          </ActionForm>
        </Card>
      )}

      {tab === "team" && <TeamTab isAdmin={isAdmin} meId={me.id} />}

      {tab === "rates" && (
        <Card className="max-w-2xl">
          <ActionForm action={saveRates} reset={false}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label">KPR hourly rate ($ ex GST)</span>
                <input name="kprHourly" inputMode="decimal" defaultValue={centsToInput(s.rates.kprHourlyCents)} className="input" />
                <span className="hint block">Used to check KPR invoices against hours logged on site.</span>
              </label>
              <label className="block">
                <span className="label">Default quote markup %</span>
                <input name="defaultMarkupPct" type="number" step="0.5" defaultValue={s.rates.defaultMarkupPct} className="input" />
              </label>
              <label className="block">
                <span className="label">GST %</span>
                <input name="gstPct" type="number" step="0.5" defaultValue={s.rates.gstPct} className="input" />
              </label>
              <label className="block">
                <span className="label">Quotes valid for (days)</span>
                <input name="quoteValidDays" type="number" defaultValue={s.rates.quoteValidDays} className="input" />
              </label>
            </div>
            <p className="hint mt-3">Supervisor hourly costs are set per person on the Team tab.</p>
            <SubmitButton className="btn-primary mt-4">Save</SubmitButton>
          </ActionForm>
        </Card>
      )}

      {tab === "templates" && (
        <Card className="max-w-3xl">
          <ActionForm action={saveTemplates} reset={false}>
            <div className="space-y-4">
              <label className="block">
                <span className="label">Site induction checklist (one item per line)</span>
                <textarea name="inductionItems" rows={7} defaultValue={s.templates.inductionItems.join("\n")} className="input text-sm" />
                <span className="hint block">Every worker must tick each item and sign before starting on site.</span>
              </label>
              <label className="block">
                <span className="label">Subcontractor agreement terms</span>
                <textarea name="subcontractTerms" rows={12} defaultValue={s.templates.subcontractTerms} className="input text-sm" />
              </label>
              <label className="block">
                <span className="label">Client contract terms</span>
                <textarea name="clientContractTerms" rows={10} defaultValue={s.templates.clientContractTerms} className="input text-sm" />
              </label>
              <label className="block">
                <span className="label">Quote terms & notes</span>
                <textarea name="quoteTerms" rows={5} defaultValue={s.templates.quoteTerms} className="input text-sm" />
              </label>
            </div>
            <p className="hint mt-3">Changes apply to new documents. Existing drafts keep their text.</p>
            <SubmitButton className="btn-primary mt-4">Save templates</SubmitButton>
          </ActionForm>
        </Card>
      )}

      {tab === "xero" && <XeroTab status={sp.xero} isAdmin={isAdmin} xeroSettings={s.xero} />}

      {tab === "account" && (
        <div className="max-w-2xl space-y-5">
          <Card title="Change password">
            <ActionForm action={changeMyPassword}>
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="current" type="password" required placeholder="Current password" className="input" autoComplete="current-password" />
                <input name="next" type="password" required minLength={8} placeholder="New password (8+ characters)" className="input" autoComplete="new-password" />
              </div>
              <SubmitButton className="btn-primary mt-4">Change password</SubmitButton>
            </ActionForm>
          </Card>
          <Card title="Email sending">
            {emailEnabled() ? (
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-leaf" /> Email is set up – quotes, agreements, variations and KPR orders send directly from the app.
              </p>
            ) : (
              <p className="text-sm text-muted">
                Email isn&apos;t set up, so send buttons open your own email app with everything filled in. To send directly, add SMTP details to the server settings (see README).
              </p>
            )}
          </Card>
          <Card title="Install the apps">
            <p className="text-sm text-muted">
              On a phone, open <b>{appUrl()}/site</b> (site app) or <b>{appUrl()}/office</b> (office app) and choose <b>Add to Home Screen</b> (iPhone: Share → Add to Home Screen; Android: ⋮ → Install app).
            </p>
          </Card>
        </div>
      )}
    </>
  );
}

async function TeamTab({ isAdmin, meId }: { isAdmin: boolean; meId: number }) {
  const list = await db.select().from(users).orderBy(asc(users.name));
  return (
    <Card
      title="Team & logins"
      pad={false}
      action={
        isAdmin ? (
          <Modal title="Add person" trigger={<><Plus className="size-4" /> Person</>} triggerClassName="btn btn-sm btn-primary">
            <ActionForm action={createUser} success="Person added">
              <UserFields />
              <SubmitButton className="btn-primary mt-4 w-full">Add</SubmitButton>
            </ActionForm>
          </Modal>
        ) : null
      }
    >
      <ul className="divide-y divide-line">
        {list.map((u) => (
          <li key={u.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={u.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-medium">
                {u.name} {u.id === meId && <span className="text-xs text-muted">(you)</span>}
                {!u.active && <Badge tone="bad">Disabled</Badge>}
              </div>
              <div className="truncate text-xs text-muted">
                {u.email}
                {u.hourlyRateCents ? ` · $${(u.hourlyRateCents / 100).toFixed(2)}/h` : ""}
              </div>
            </div>
            <Badge tone={u.role === "admin" ? "strong" : u.role === "office" ? "info" : "neutral"}>{ROLES[u.role as Role]}</Badge>
            {isAdmin && (
              <Modal title={`Edit ${u.name}`} trigger="Edit" triggerClassName="btn btn-sm">
                <ActionForm action={updateUser.bind(null, u.id)} reset={false}>
                  <UserFields u={u} />
                  <SubmitButton className="btn-primary mt-4 w-full">Save</SubmitButton>
                </ActionForm>
              </Modal>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

async function XeroTab({ status, isAdmin, xeroSettings }: { status?: string; isAdmin: boolean; xeroSettings: { expenseAccountCode: string; salesAccountCode: string; trackingCategory: string; billStatus: string } }) {
  const conn = await getXeroConnection();
  const configured = xeroConfigured();
  const msg: Record<string, [string, string]> = {
    connected: ["Xero connected.", "bg-leaf-soft text-leaf"],
    denied: ["Xero connection was cancelled.", "bg-clay-soft text-clay-ink"],
    invalid: ["The Xero sign-in expired – please try again.", "bg-clay-soft text-clay-ink"],
    error: ["Couldn't connect to Xero. Check the client ID, secret and redirect URI.", "bg-clay-soft text-clay-ink"],
    "not-configured": ["Xero app keys aren't set on the server yet.", "bg-clay-soft text-clay-ink"],
  };
  return (
    <div className="max-w-2xl space-y-5">
      {status && msg[status] && <div className={`rounded-xl p-3 text-sm ${msg[status][1]}`}>{msg[status][0]}</div>}
      <Card title="Connection">
        {!configured ? (
          <div className="space-y-2 text-sm text-muted">
            <p>To connect Xero:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Create a <b>Web app</b> at developer.xero.com → My Apps.
              </li>
              <li>
                Set the redirect URI to <code className="rounded bg-subtle px-1">{xeroRedirectUri()}</code>
              </li>
              <li>
                Add <code className="rounded bg-subtle px-1">XERO_CLIENT_ID</code> and <code className="rounded bg-subtle px-1">XERO_CLIENT_SECRET</code> to the server settings and restart.
              </li>
            </ol>
          </div>
        ) : conn ? (
          <div className="flex flex-wrap items-center gap-3">
            <CheckCircle2 className="size-5 text-leaf" />
            <div className="flex-1 text-sm">
              Connected to <b>{conn.tenantName}</b>
              <div className="text-xs text-muted">since {fmtDateTime(new Date(conn.connectedAt))}</div>
            </div>
            <a href="/api/xero/connect" className="btn btn-sm">
              Reconnect
            </a>
            {isAdmin && (
              <ActionButton action={disconnectXero} confirm="Disconnect Xero?" className="btn-sm btn-ghost btn-danger">
                Disconnect
              </ActionButton>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">Approved invoices go to Xero as bills; approved variations become draft invoices; paid status syncs back.</p>
            <a href="/api/xero/connect" className="btn btn-primary">
              Connect Xero
            </a>
          </div>
        )}
      </Card>
      <Card title="How items are coded in Xero">
        <ActionForm action={saveXeroSettings} reset={false}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Job cost account code</span>
              <input name="expenseAccountCode" defaultValue={xeroSettings.expenseAccountCode} className="input" />
            </label>
            <label className="block">
              <span className="label">Sales account code</span>
              <input name="salesAccountCode" defaultValue={xeroSettings.salesAccountCode} className="input" />
            </label>
            <label className="block">
              <span className="label">Tracking category for jobs (optional)</span>
              <input name="trackingCategory" defaultValue={xeroSettings.trackingCategory} className="input" placeholder="e.g. Jobs" />
              <span className="hint block">Each job is added as an option so Xero reports costs by job.</span>
            </label>
            <label className="block">
              <span className="label">Send bills to Xero as</span>
              <select name="billStatus" defaultValue={xeroSettings.billStatus} className="input">
                <option value="DRAFT">Draft (review in Xero)</option>
                <option value="AUTHORISED">Awaiting payment</option>
              </select>
            </label>
          </div>
          <SubmitButton className="btn-primary mt-4">Save</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
