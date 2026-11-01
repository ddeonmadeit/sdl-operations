import { ActionForm, SignaturePad, SubmitButton } from "@/components/client";
import type { ActionState } from "@/lib/form";

/** Site induction: worker details, site info, every checklist item ticked, and a signature. */
export function InductionForm({
  action,
  items,
  siteInfo,
  companies,
  submitText = "Sign induction",
}: {
  action: (fd: FormData) => Promise<ActionState>;
  items: string[];
  siteInfo: string | null;
  companies: string[];
  submitText?: string;
}) {
  return (
    <ActionForm action={action} success="Induction signed">
      <div className="space-y-4">
        {siteInfo && (
          <div className="rounded-xl border border-line bg-subtle p-4 text-sm text-ink">
            <div className="mb-1 text-xs font-bold tracking-wide uppercase">Site information</div>
            <p className="prose-pre">{siteInfo}</p>
          </div>
        )}
        <label className="block">
          <span className="label">Full name</span>
          <input name="name" required className="input" autoComplete="name" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 block sm:col-span-1">
            <span className="label">Company</span>
            <input name="company" className="input" list="induction-companies" placeholder="e.g. KPR Labour Hire" />
            <datalist id="induction-companies">
              {companies.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="col-span-2 block sm:col-span-1">
            <span className="label">Mobile</span>
            <input name="phone" type="tel" className="input" autoComplete="tel" />
          </label>
          <label className="block">
            <span className="label">White card no.</span>
            <input name="whiteCard" className="input" />
          </label>
          <label className="block">
            <span className="label">Emergency contact</span>
            <input name="emergencyContact" className="input" placeholder="Name & phone" />
          </label>
        </div>
        <fieldset className="space-y-2">
          <span className="label">Confirm each item</span>
          {items.map((item) => (
            <label key={item} className="flex items-start gap-3 rounded-xl border border-line px-3 py-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
              <input type="checkbox" name="answers" value={item} required className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]" />
              <span className="text-sm">{item}</span>
            </label>
          ))}
        </fieldset>
        <div>
          <span className="label">Worker signature</span>
          <SignaturePad />
        </div>
        <SubmitButton className="btn-primary btn-lg w-full">{submitText}</SubmitButton>
      </div>
    </ActionForm>
  );
}
