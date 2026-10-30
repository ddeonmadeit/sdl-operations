"use client";

import { Minus, Plus, X } from "lucide-react";
import { useState } from "react";

type Row = { key: number; name: string; hours: string };
let n = 0;

/** Supervisor's own hours + a list of KPR workers with hours. */
export function LabourRows({
  myName,
  myHours,
  kpr,
  defaultHours = 8,
}: {
  myName: string;
  myHours: number | null;
  kpr: { name: string; hours: number }[];
  defaultHours?: number;
}) {
  const [rows, setRows] = useState<Row[]>(() => kpr.map((r) => ({ key: ++n, name: r.name, hours: String(r.hours) })));
  const [mine, setMine] = useState(myHours == null ? String(defaultHours) : String(myHours));
  const total = rows.reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);

  const step = (v: string, d: number) => String(Math.max(0, Math.min(16, (parseFloat(v) || 0) + d)));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
        <input type="hidden" name="labourKind" value="sdl" />
        <input type="hidden" name="labourName" value={myName} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">My hours</div>
          <div className="text-xs text-muted">SDL supervisor – {myName}</div>
        </div>
        <Stepper value={mine} onChange={setMine} onStep={(d) => setMine((v) => step(v, d))} name="labourHours" />
      </div>

      <div className="rounded-xl border border-line">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <span className="text-sm font-semibold">KPR workers</span>
          <span className="text-xs text-muted">
            {rows.length} · {total}h total
          </span>
        </div>
        <ul className="divide-y divide-line">
          {rows.map((r, i) => (
            <li key={r.key} className="flex items-center gap-2 px-3 py-2">
              <input type="hidden" name="labourKind" value="kpr" />
              <input
                name="labourName"
                value={r.name}
                onChange={(e) => setRows((list) => list.map((x) => (x.key === r.key ? { ...x, name: e.target.value } : x)))}
                className="input input-sm min-w-0 flex-1"
                placeholder={`Worker ${i + 1} name`}
              />
              <Stepper
                value={r.hours}
                name="labourHours"
                onChange={(v) => setRows((list) => list.map((x) => (x.key === r.key ? { ...x, hours: v } : x)))}
                onStep={(d) => setRows((list) => list.map((x) => (x.key === r.key ? { ...x, hours: step(x.hours, d) } : x)))}
              />
              <button type="button" onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))} className="grid size-8 place-items-center text-muted" aria-label="Remove worker">
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setRows((list) => [...list, { key: ++n, name: `KPR worker ${list.length + 1}`, hours: String(defaultHours) }])}
          className="flex w-full items-center justify-center gap-1.5 border-t border-line py-2.5 text-sm font-semibold text-accent"
        >
          <Plus className="size-4" /> Add KPR worker
        </button>
      </div>
    </div>
  );
}

function Stepper({ value, onChange, onStep, name }: { value: string; onChange: (v: string) => void; onStep: (d: number) => void; name: string }) {
  return (
    <div className="flex shrink-0 items-center rounded-lg border border-line-strong">
      <button type="button" onClick={() => onStep(-0.5)} className="grid size-9 place-items-center text-muted" aria-label="Less">
        <Minus className="size-4" />
      </button>
      <input
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="w-11 border-x border-line bg-transparent py-1.5 text-center text-sm font-semibold tabular-nums outline-none"
        aria-label="Hours"
      />
      <button type="button" onClick={() => onStep(0.5)} className="grid size-9 place-items-center text-muted" aria-label="More">
        <Plus className="size-4" />
      </button>
    </div>
  );
}
