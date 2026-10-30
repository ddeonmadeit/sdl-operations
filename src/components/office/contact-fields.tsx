import type { Contact } from "@/db/schema";
import { CONTACT_TYPES, TRADES } from "@/lib/constants";

export function ContactFields({ c, type }: { c?: Contact; type?: string }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Type</span>
          <select name="type" defaultValue={c?.type ?? type ?? "client"} className="input">
            {Object.entries(CONTACT_TYPES).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Trade</span>
          <input name="trade" defaultValue={c?.trade ?? ""} className="input" list="trades" placeholder="Subbies only" />
          <datalist id="trades">
            {TRADES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
      </div>
      <label className="block">
        <span className="label">Name (company or person)</span>
        <input name="name" required defaultValue={c?.name} className="input" />
      </label>
      <label className="block">
        <span className="label">Contact person</span>
        <input name="contactName" defaultValue={c?.contactName ?? ""} className="input" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Phone</span>
          <input name="phone" type="tel" defaultValue={c?.phone ?? ""} className="input" />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" defaultValue={c?.email ?? ""} className="input" />
        </label>
      </div>
      <label className="block">
        <span className="label">Address</span>
        <input name="address" defaultValue={c?.address ?? ""} className="input" />
      </label>
      <label className="block">
        <span className="label">ABN</span>
        <input name="abn" defaultValue={c?.abn ?? ""} className="input" inputMode="numeric" />
      </label>
      <label className="block">
        <span className="label">Notes</span>
        <textarea name="notes" rows={2} defaultValue={c?.notes ?? ""} className="input" />
      </label>
    </div>
  );
}
