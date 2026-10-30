"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" className="btn btn-sm btn-ghost" onClick={() => window.print()}>
      <Printer className="size-4" /> Print / save PDF
    </button>
  );
}
