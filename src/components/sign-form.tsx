"use client";

import { useState } from "react";
import type { ActionState } from "@/lib/form";
import { ActionForm, SignaturePad, SubmitButton } from "./client";

export function SignForm({
  sign,
  decline,
  agreeText,
  buttonText,
  defaultName,
}: {
  sign: (fd: FormData) => Promise<ActionState>;
  decline?: (fd: FormData) => Promise<ActionState>;
  agreeText: string;
  buttonText: string;
  defaultName?: string;
}) {
  const [declining, setDeclining] = useState(false);
  if (declining && decline)
    return (
      <ActionForm action={decline} reset={false}>
        <label className="block">
          <span className="label">Anything we should know? (optional)</span>
          <textarea name="reason" rows={3} className="input" />
        </label>
        <div className="mt-3 flex gap-2">
          <button type="button" className="btn flex-1" onClick={() => setDeclining(false)}>
            Back
          </button>
          <SubmitButton className="btn-primary flex-1">Decline</SubmitButton>
        </div>
      </ActionForm>
    );
  return (
    <ActionForm action={sign} reset={false}>
      <div className="space-y-4">
        <label className="block">
          <span className="label">Full name</span>
          <input name="name" required defaultValue={defaultName} className="input" autoComplete="name" />
        </label>
        <div>
          <span className="label">Signature</span>
          <SignaturePad />
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="agree" required className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]" />
          <span>{agreeText}</span>
        </label>
        <SubmitButton className="btn-primary btn-lg w-full">{buttonText}</SubmitButton>
        {decline && (
          <button type="button" className="w-full text-center text-sm text-muted hover:text-ink" onClick={() => setDeclining(true)}>
            Decline
          </button>
        )}
      </div>
    </ActionForm>
  );
}
