"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ActionState } from "@/lib/form";
import { ActionForm, SubmitButton } from "../client";
import { cx } from "../ui";

type Item = {
  key: string;
  section: string;
  description: string;
  qty: number;
  unit: string;
  unitCostCents: number;
  unitPriceCents: number;
  priceTouched?: boolean;
};

const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const fmt = (c: number) => aud.format(c / 100);
const toInput = (c: number) => (c ? (c / 100).toString() : "");
const fromInput = (v: string) => Math.round((parseFloat(v.replace(/[$,]/g, "")) || 0) * 100);
let seq = 0;
const key = () => `k${++seq}`;

export function QuoteEditor({
  quote,
  items: initial,
  sections,
  gstPct,
  readOnly,
  save,
}: {
  quote: { title: string; kind: string; notes: string | null; validUntil: string | null; markupPct: number };
  items: Omit<Item, "key">[];
  sections: string[];
  gstPct: number;
  readOnly: boolean;
  save: (fd: FormData) => Promise<ActionState>;
}) {
  const [items, setItems] = useState<Item[]>(() => initial.map((i) => ({ ...i, key: key(), priceTouched: true })));
  const [markup, setMarkup] = useState(quote.markupPct);
  const [extraSections, setExtraSections] = useState<string[]>([]);

  const usedSections = useMemo(() => {
    const s = new Set<string>();
    for (const i of items) s.add(i.section);
    for (const x of extraSections) s.add(x);
    // Keep the job's stage order
    return [...sections.filter((x) => s.has(x)), ...[...s].filter((x) => !sections.includes(x))];
  }, [items, extraSections, sections]);
  const unusedSections = sections.filter((s) => !usedSections.includes(s));

  const totals = useMemo(() => {
    const cost = items.reduce((s, i) => s + i.qty * i.unitCostCents, 0);
    const sell = items.reduce((s, i) => s + i.qty * i.unitPriceCents, 0);
    return { cost, sell, margin: sell - cost, pct: sell ? ((sell - cost) / sell) * 100 : 0, gst: Math.round((sell * gstPct) / 100) };
  }, [items, gstPct]);

  const update = (k: string, patch: Partial<Item>) =>
    setItems((list) =>
      list.map((i) => {
        if (i.key !== k) return i;
        const next = { ...i, ...patch };
        if ("unitCostCents" in patch && !i.priceTouched) next.unitPriceCents = Math.round(next.unitCostCents * (1 + markup / 100));
        return next;
      }),
    );

  const addLine = (section: string) =>
    setItems((list) => [...list, { key: key(), section, description: "", qty: 1, unit: "item", unitCostCents: 0, unitPriceCents: 0 }]);

  const applyMarkup = () =>
    setItems((list) => list.map((i) => ({ ...i, unitPriceCents: Math.round(i.unitCostCents * (1 + markup / 100)), priceTouched: false })));

  return (
    <ActionForm action={save} reset={false} success="Quote saved">
      <input type="hidden" name="items" value={JSON.stringify(items.map(({ key: _k, priceTouched: _p, ...rest }) => rest))} />
      <fieldset disabled={readOnly} className="space-y-5">
        <div className="card grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto]">
          <label className="block">
            <span className="label">Title</span>
            <input name="title" defaultValue={quote.title} className="input" required />
          </label>
          <label className="block">
            <span className="label">Type</span>
            <select name="kind" defaultValue={quote.kind} className="input">
              <option value="estimate">Estimate</option>
              <option value="quote">Quote</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Valid until</span>
            <input name="validUntil" type="date" defaultValue={quote.validUntil ?? ""} className="input" />
          </label>
          <label className="block">
            <span className="label">Markup %</span>
            <div className="flex gap-1.5">
              <input
                name="markupPct"
                type="number"
                step="0.5"
                value={markup}
                onChange={(e) => setMarkup(Number(e.target.value))}
                className="input w-20"
              />
              <button type="button" className="btn btn-sm h-11" onClick={applyMarkup} title="Re-price every line at this markup">
                Apply
              </button>
            </div>
          </label>
        </div>

        {usedSections.map((section) => {
          const list = items.filter((i) => i.section === section);
          const sub = list.reduce((s, i) => s + i.qty * i.unitPriceCents, 0);
          return (
            <section key={section || "general"} className="card overflow-hidden">
              <header className="flex items-center justify-between gap-3 border-b border-line bg-subtle/60 px-4 py-2.5">
                <h3 className="text-sm font-semibold">{section || "General"}</h3>
                <span className="text-sm font-semibold tabular-nums">{fmt(sub)}</span>
              </header>
              <div className="hidden grid-cols-[1fr_70px_70px_100px_100px_90px_32px] gap-2 px-4 pt-2 text-[0.7rem] font-semibold tracking-wide text-muted uppercase md:grid">
                <span>Description</span>
                <span>Qty</span>
                <span>Unit</span>
                <span>Cost / unit</span>
                <span>Sell / unit</span>
                <span className="text-right">Total</span>
                <span />
              </div>
              <ul className="divide-y divide-line md:divide-y-0">
                {list.map((i) => (
                  <li key={i.key} className="grid grid-cols-6 gap-2 px-4 py-3 md:grid-cols-[1fr_70px_70px_100px_100px_90px_32px] md:items-center md:py-1.5">
                    <input
                      value={i.description}
                      onChange={(e) => update(i.key, { description: e.target.value })}
                      placeholder="Description"
                      className="input input-sm col-span-5 md:col-span-1"
                    />
                    <button type="button" className="btn btn-ghost btn-icon btn-sm col-span-1 justify-self-end md:order-last" onClick={() => setItems((l) => l.filter((x) => x.key !== i.key))} aria-label="Remove line">
                      <Trash2 className="size-4 text-muted" />
                    </button>
                    <label className="col-span-2 md:col-span-1">
                      <span className="text-[0.7rem] text-muted md:hidden">Qty</span>
                      <input type="number" step="any" value={i.qty} onChange={(e) => update(i.key, { qty: Number(e.target.value) })} className="input input-sm" />
                    </label>
                    <label className="col-span-2 md:col-span-1">
                      <span className="text-[0.7rem] text-muted md:hidden">Unit</span>
                      <input value={i.unit} onChange={(e) => update(i.key, { unit: e.target.value })} className="input input-sm" list="units" />
                    </label>
                    <span className="col-span-2 self-end pb-2 text-right text-sm font-semibold tabular-nums md:hidden">{fmt(i.qty * i.unitPriceCents)}</span>
                    <label className="col-span-3 md:col-span-1">
                      <span className="text-[0.7rem] text-muted md:hidden">Cost / unit</span>
                      <MoneyInput cents={i.unitCostCents} onChange={(c) => update(i.key, { unitCostCents: c })} />
                    </label>
                    <label className="col-span-3 md:col-span-1">
                      <span className="text-[0.7rem] text-muted md:hidden">Sell / unit</span>
                      <MoneyInput
                        cents={i.unitPriceCents}
                        onChange={(c) => update(i.key, { unitPriceCents: c, priceTouched: true })}
                        className={cx(!i.priceTouched && i.unitPriceCents > 0 && "text-muted")}
                      />
                    </label>
                    <span className="hidden text-right text-sm font-medium tabular-nums md:block">{fmt(i.qty * i.unitPriceCents)}</span>
                  </li>
                ))}
              </ul>
              <div className="px-4 pb-3">
                <button type="button" className="btn btn-ghost btn-sm mt-1 text-accent" onClick={() => addLine(section)}>
                  <Plus className="size-4" /> Line
                </button>
              </div>
            </section>
          );
        })}

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input input-sm w-auto"
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              const name = v === "__general" ? "" : v;
              setExtraSections((x) => [...x, name]);
              addLine(name);
            }}
          >
            <option value="">+ Add a section…</option>
            {unusedSections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            {!usedSections.includes("") && <option value="__general">General</option>}
          </select>
        </div>

        <label className="block">
          <span className="label">Notes, inclusions & terms (shown to the client)</span>
          <textarea name="notes" defaultValue={quote.notes ?? ""} rows={5} className="input text-sm" />
        </label>
      </fieldset>

      <datalist id="units">
        {["item", "m²", "lm", "m³", "hr", "day", "each", "lot"].map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <div className="safe-bottom sticky bottom-16 z-20 -mx-4 mt-5 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border lg:bottom-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Total label="Cost" value={fmt(totals.cost)} />
          <Total label="Sell (ex GST)" value={fmt(totals.sell)} strong />
          <Total label="Margin" value={`${fmt(totals.margin)} · ${totals.pct.toFixed(1)}%`} tone={totals.margin < 0 ? "bad" : "good"} />
          <Total label="Inc GST" value={fmt(totals.sell + totals.gst)} />
          <div className="flex-1" />
          {!readOnly && <SubmitButton className="btn-primary">Save quote</SubmitButton>}
        </div>
      </div>
    </ActionForm>
  );
}

function Total({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "good" | "bad" }) {
  return (
    <div className="leading-tight">
      <div className="text-[0.7rem] font-medium text-muted">{label}</div>
      <div className={cx("tabular-nums", strong ? "text-lg font-bold" : "text-sm font-semibold", tone === "bad" && "text-red-700", tone === "good" && "text-green-700")}>{value}</div>
    </div>
  );
}

/** Keeps the typed text (so "12." works) while reporting cents upward. */
function MoneyInput({ cents, onChange, className }: { cents: number; onChange: (c: number) => void; className?: string }) {
  const [text, setText] = useState(toInput(cents));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(toInput(cents));
  }, [cents, focused]);
  return (
    <input
      inputMode="decimal"
      value={text}
      placeholder="0"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setText(e.target.value);
        onChange(fromInput(e.target.value));
      }}
      className={cx("input input-sm", className)}
    />
  );
}
