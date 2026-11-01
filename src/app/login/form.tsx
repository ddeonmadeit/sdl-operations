"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" autoComplete="email" inputMode="email" required className="input" autoFocus />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className="input" />
      </label>
      {state?.error && <p className="rounded-lg bg-clay-soft px-3 py-2 text-sm text-clay-ink">{state.error}</p>}
      <button className="btn btn-primary btn-lg w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />} Sign in
      </button>
    </form>
  );
}
