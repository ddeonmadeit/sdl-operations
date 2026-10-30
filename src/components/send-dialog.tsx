"use client";

import { ExternalLink, Mail, Send } from "lucide-react";
import { useRef, useTransition } from "react";
import type { ActionState } from "@/lib/form";
import { CopyButton, Modal, toast, useModal } from "./client";

type Msg = { to: string; subject: string; body: string; link?: string };

function SendForm({
  message,
  smtp,
  action,
  manualLabel,
}: {
  message: Msg;
  smtp: boolean;
  action: (fd: FormData) => Promise<ActionState>;
  manualLabel: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const modal = useModal();

  const run = (mode: "email" | "manual", openMail = false) => {
    const form = ref.current!;
    const fd = new FormData(form);
    fd.set("mode", mode);
    if (openMail) {
      const href = `mailto:${encodeURIComponent(String(fd.get("to") || ""))}?subject=${encodeURIComponent(String(fd.get("subject") || ""))}&body=${encodeURIComponent(String(fd.get("body") || ""))}`;
      window.location.href = href;
    }
    start(async () => {
      const r = await action(fd);
      if (r?.error) return toast(r.error, "error");
      toast(r?.message || "Done");
      modal?.close();
    });
  };

  return (
    <form ref={ref} className="space-y-3" onSubmit={(e) => (e.preventDefault(), run(smtp ? "email" : "manual", !smtp))}>
      <label className="block">
        <span className="label">To</span>
        <input name="to" type="email" defaultValue={message.to} className="input" placeholder="name@example.com" />
      </label>
      <label className="block">
        <span className="label">Subject</span>
        <input name="subject" defaultValue={message.subject} className="input" />
      </label>
      <label className="block">
        <span className="label">Message</span>
        <textarea name="body" defaultValue={message.body} rows={9} className="input text-sm" />
      </label>
      {message.link && (
        <div className="flex items-center gap-2 rounded-lg bg-subtle p-2 pl-3 text-xs">
          <span className="min-w-0 flex-1 truncate text-muted">{message.link}</span>
          <CopyButton text={message.link} className="btn-sm" label="Copy" />
          <a href={message.link} target="_blank" rel="noreferrer" className="btn btn-sm" aria-label="Preview">
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      )}
      <div className="flex flex-col gap-2 pt-1 sm:flex-row-reverse">
        {smtp ? (
          <button type="button" disabled={pending} className="btn btn-primary flex-1" onClick={() => run("email")}>
            <Send className="size-4" /> Send email
          </button>
        ) : (
          <button type="button" disabled={pending} className="btn btn-primary flex-1" onClick={() => run("manual", true)}>
            <Mail className="size-4" /> Open in email app
          </button>
        )}
        <button type="button" disabled={pending} className="btn flex-1" onClick={() => run("manual")}>
          {manualLabel}
        </button>
      </div>
      {!smtp && <p className="hint">Email sending isn&apos;t set up, so this opens your own email app with everything filled in.</p>}
    </form>
  );
}

export function SendDialog({
  title,
  trigger,
  triggerClassName,
  message,
  smtp,
  action,
  manualLabel = "Mark as sent",
}: {
  title: string;
  trigger: React.ReactNode;
  triggerClassName?: string;
  message: Msg;
  smtp: boolean;
  action: (fd: FormData) => Promise<ActionState>;
  manualLabel?: string;
}) {
  return (
    <Modal title={title} trigger={trigger} triggerClassName={triggerClassName ?? "btn btn-primary"}>
      <SendForm message={message} smtp={smtp} action={action} manualLabel={manualLabel} />
    </Modal>
  );
}
