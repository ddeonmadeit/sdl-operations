"use client";

import { Check, Copy, ImagePlus, Loader2, Paperclip, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOffline } from "next/offline";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/form";
import { cx } from "./ui";

/* ───────────── Toasts ───────────── */

type ToastItem = { id: number; text: string; kind: "ok" | "error" };
let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string, kind: "ok" | "error" = "ok") {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, text, kind }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, kind === "error" ? 5000 : 2600);
}

export function Toaster() {
  const items = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
    () => toasts,
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[100] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          className={cx(
            "pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-cream shadow-[var(--shadow-pop)]",
            t.kind === "error" ? "bg-clay-ink" : "bg-ink",
          )}
          style={{ animation: "toast-in .2s cubic-bezier(.2,.9,.3,1)" }}
          role="status"
        >
          {t.kind === "error" ? <X className="size-4 shrink-0" /> : <Check className="size-4 shrink-0" />}
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div role="status" className="safe-top fixed inset-x-0 top-0 z-[90] bg-clay px-4 py-1.5 text-center text-xs font-semibold text-cream">
      No signal – anything you save will send automatically when you&apos;re back online.
    </div>
  );
}

/* ───────────── Forms ───────────── */

const PendingCtx = createContext(false);
type Result = (ActionState & { redirect?: string }) | void | null;

export function ActionForm({
  action,
  children,
  className,
  success,
  reset = true,
  close = true,
  confirm,
  onSuccess,
  then,
  id,
}: {
  action: (fd: FormData) => Promise<Result>;
  children: React.ReactNode;
  className?: string;
  success?: string;
  reset?: boolean;
  close?: boolean;
  confirm?: string;
  onSuccess?: () => void;
  /** Navigate here after a successful save (e.g. back to the job). */
  then?: string;
  id?: string;
}) {
  const [pending, start] = useTransition();
  const modal = useContext(ModalCtx);
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);

  return (
    <PendingCtx.Provider value={pending}>
      <form
        id={id}
        ref={ref}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          if (form.querySelector('[data-uploading="true"]')) {
            toast("Photos are still uploading…", "error");
            return;
          }
          if (confirm && !window.confirm(confirm)) return;
          const fd = new FormData(form);
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          if (submitter?.name) fd.set(submitter.name, submitter.value);
          start(async () => {
            try {
              const r = await action(fd);
              if (r && r.error) {
                toast(r.error, "error");
                return;
              }
              if (r?.message || success) toast(r?.message || success!);
              form.dispatchEvent(new Event("sdl:saved"));
              if (reset) {
                form.reset();
                form.dispatchEvent(new Event("sdl:reset"));
              }
              if (close) modal?.close();
              onSuccess?.();
              if (r?.redirect) router.push(r.redirect);
              else if (then) router.push(then);
            } catch (err) {
              console.error(err);
              toast("Something went wrong. Please try again.", "error");
            }
          });
        }}
      >
        {children}
      </form>
    </PendingCtx.Provider>
  );
}

export function SubmitButton({
  children,
  className,
  name,
  value,
  pendingText,
}: {
  children: React.ReactNode;
  className?: string;
  name?: string;
  value?: string;
  pendingText?: string;
}) {
  const ctxPending = useContext(PendingCtx);
  const { pending: formPending } = useFormStatus();
  const pending = ctxPending || formPending;
  return (
    <button type="submit" name={name} value={value} className={cx("btn", className ?? "btn-primary")} disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/** One-tap server action button (no fields). */
export function ActionButton({
  action,
  children,
  className,
  confirm,
  success,
  title,
}: {
  action: () => Promise<Result>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  success?: string;
  title?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      title={title}
      className={cx("btn", className)}
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          try {
            const r = await action();
            if (r && r.error) return toast(r.error, "error");
            if (r?.message || success) toast(r?.message || success!);
            if (r?.redirect) router.push(r.redirect);
          } catch (err) {
            console.error(err);
            toast("Something went wrong. Please try again.", "error");
          }
        });
      }}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

/** A select that saves as soon as it changes. */
export function AutoSelect({
  action,
  name,
  defaultValue,
  options,
  className,
  success = "Saved",
  ariaLabel,
}: {
  action: (fd: FormData) => Promise<Result>;
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  className?: string;
  success?: string;
  ariaLabel?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={ariaLabel}
      name={name}
      defaultValue={defaultValue}
      disabled={pending}
      className={cx("input input-sm", className)}
      onChange={(e) => {
        const fd = new FormData();
        fd.set(name, e.target.value);
        start(async () => {
          const r = await action(fd);
          if (r && r.error) toast(r.error, "error");
          else toast(success);
        });
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Optimistic checkbox row – used for scope items, tasks. */
export function CheckRow({
  checked,
  action,
  children,
  disabled,
}: {
  checked: boolean;
  action: () => Promise<Result>;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const [optimistic, setOptimistic] = useOptimistic(checked);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          const r = await action();
          if (r && r.error) toast(r.error, "error");
        })
      }
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-subtle disabled:cursor-default disabled:hover:bg-transparent"
    >
      <span
        className={cx(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition",
          optimistic ? "border-accent bg-accent text-cream" : "border-line-strong bg-surface",
        )}
      >
        {optimistic && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <span className={cx("min-w-0 flex-1 text-[0.9375rem]", optimistic && "text-muted line-through decoration-line-strong")}>
        {children}
      </span>
    </button>
  );
}

/* ───────────── Modal / bottom sheet ───────────── */

const ModalCtx = createContext<{ close: () => void } | null>(null);

export function Modal({
  trigger,
  triggerClassName,
  title,
  children,
  triggerTitle,
}: {
  trigger: React.ReactNode;
  triggerClassName?: string;
  title: string;
  children: React.ReactNode;
  triggerTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button type="button" title={triggerTitle} className={triggerClassName ?? "btn"} onClick={() => setOpen(true)}>
        {trigger}
      </button>
      <dialog
        ref={ref}
        className="sheet"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === ref.current) setOpen(false);
        }}
      >
        {open && (
          <ModalCtx.Provider value={{ close }}>
            <div className="flex max-h-[inherit] flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
                <h2 className="text-base font-semibold">{title}</h2>
                <button type="button" className="btn btn-ghost btn-icon btn-sm -mr-2" onClick={close} aria-label="Close">
                  <X className="size-5" />
                </button>
              </div>
              <div className="overflow-y-auto px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
            </div>
          </ModalCtx.Provider>
        )}
      </dialog>
    </>
  );
}

export function useModal() {
  return useContext(ModalCtx);
}

/* ───────────── Clipboard ───────────── */

export function CopyButton({ text, label = "Copy link", className }: { text: string; label?: string; className?: string }) {
  return (
    <button
      type="button"
      className={cx("btn", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast("Copied to clipboard");
        } catch {
          window.prompt("Copy this:", text);
        }
      }}
    >
      <Copy className="size-4" /> {label}
    </button>
  );
}

/* ───────────── Uploads ───────────── */

type Uploaded = { key: string; id?: number; name: string; preview?: string; isImage: boolean; error?: boolean };

async function compressImage(file: File, max = 1600, quality = 0.82): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export function Uploader({
  jobId,
  category = "photo",
  name = "fileIds",
  variant = "photos",
  label,
}: {
  jobId?: number;
  category?: string;
  name?: string;
  variant?: "photos" | "files";
  label?: string;
}) {
  const [items, setItems] = useState<Uploaded[]>([]);
  const [busy, setBusy] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = wrapRef.current?.closest("form");
    if (!form) return;
    const onReset = () => setItems([]);
    form.addEventListener("sdl:reset", onReset);
    return () => form.removeEventListener("sdl:reset", onReset);
  }, []);

  async function handle(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list);
    for (const file of files) {
      const key = `${file.name}-${Math.random()}`;
      const isImage = file.type.startsWith("image/");
      const preview = isImage ? URL.createObjectURL(file) : undefined;
      setItems((s) => [...s, { key, name: file.name, preview, isImage }]);
      setBusy((b) => b + 1);
      try {
        const body = isImage ? await compressImage(file) : file;
        const fd = new FormData();
        const fname = isImage && body !== file ? file.name.replace(/\.\w+$/, "") + ".jpg" : file.name;
        fd.set("file", body, fname);
        if (jobId) fd.set("jobId", String(jobId));
        fd.set("category", category);
        const res = await fetch("/api/files", { method: "POST", body: fd });
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as { id: number };
        setItems((s) => s.map((i) => (i.key === key ? { ...i, id: json.id } : i)));
      } catch (err) {
        console.error(err);
        setItems((s) => s.map((i) => (i.key === key ? { ...i, error: true } : i)));
        toast(`Couldn't upload ${file.name}`, "error");
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  const accept = variant === "photos" ? "image/*" : "image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.dwg";

  return (
    <div ref={wrapRef} data-uploading={busy > 0 ? "true" : "false"}>
      {items.filter((i) => i.id).map((i) => (
        <input key={i.key} type="hidden" name={name} value={i.id} />
      ))}
      <div className={cx(variant === "photos" ? "grid grid-cols-4 gap-2 sm:grid-cols-5" : "space-y-2")}>
        {items.map((i) =>
          variant === "photos" && i.preview ? (
            <div key={i.key} className="relative aspect-square overflow-hidden rounded-lg bg-subtle">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.preview} alt="" className="size-full object-cover" />
              {!i.id && !i.error && (
                <div className="absolute inset-0 grid place-items-center bg-olive/40">
                  <Loader2 className="size-5 animate-spin text-cream" />
                </div>
              )}
              {i.error && <div className="absolute inset-0 grid place-items-center bg-clay-ink/85 text-xs font-semibold text-cream">Failed</div>}
              <button
                type="button"
                onClick={() => setItems((s) => s.filter((x) => x.key !== i.key))}
                className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-olive/70 text-cream"
                aria-label="Remove"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <div key={i.key} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
              {!i.id && !i.error ? <Loader2 className="size-4 animate-spin text-muted" /> : <Paperclip className="size-4 text-muted" />}
              <span className={cx("min-w-0 flex-1 truncate", i.error && "text-clay")}>{i.name}</span>
              <button type="button" onClick={() => setItems((s) => s.filter((x) => x.key !== i.key))} aria-label="Remove">
                <Trash2 className="size-4 text-muted" />
              </button>
            </div>
          ),
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cx(
            "flex items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong text-sm font-medium text-muted transition hover:border-accent hover:text-accent",
            variant === "photos" ? (items.length ? "aspect-square flex-col" : "col-span-4 h-20 sm:col-span-5") : "h-11 w-full",
          )}
        >
          {variant === "photos" ? <ImagePlus className="size-5" /> : <Paperclip className="size-4" />}
          {variant === "photos" ? (items.length ? <span className="text-xs">Add</span> : label || "Add photos") : label || "Attach files"}
        </button>
      </div>
      <input ref={inputRef} type="file" accept={accept} multiple hidden onChange={(e) => handle(e.target.files)} />
    </div>
  );
}

/* ───────────── Signature ───────────── */

export function SignaturePad({ name = "signature", height = 170 }: { name?: string; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  const setup = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const w = c.offsetWidth;
    c.width = w * ratio;
    c.height = height * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#404232";
    setEmpty(true);
    if (inputRef.current) inputRef.current.value = "";
  }, [height]);

  useEffect(() => {
    setup();
    const form = canvasRef.current?.closest("form");
    form?.addEventListener("sdl:reset", setup);
    let width = canvasRef.current?.offsetWidth ?? 0;
    const onResize = () => {
      const w = canvasRef.current?.offsetWidth ?? 0;
      if (w !== width) {
        width = w;
        setup();
      }
    };
    window.addEventListener("resize", onResize);
    return () => {
      form?.removeEventListener("sdl:reset", setup);
      window.removeEventListener("resize", onResize);
    };
  }, [setup]);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-line-strong bg-surface">
        <canvas
          ref={canvasRef}
          style={{ height, touchAction: "none" }}
          className="block w-full"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            last.current = pos(e);
            const ctx = canvasRef.current!.getContext("2d")!;
            ctx.beginPath();
            ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2);
            ctx.fillStyle = "#404232";
            ctx.fill();
          }}
          onPointerMove={(e) => {
            if (!drawing.current || !last.current) return;
            const p = pos(e);
            const ctx = canvasRef.current!.getContext("2d")!;
            ctx.beginPath();
            ctx.moveTo(last.current.x, last.current.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            last.current = p;
          }}
          onPointerUp={() => {
            drawing.current = false;
            last.current = null;
            setEmpty(false);
            if (inputRef.current) inputRef.current.value = canvasRef.current!.toDataURL("image/png");
          }}
        />
        {empty && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted">Sign here with your finger</div>
        )}
        <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-line-strong" />
      </div>
      <div className="mt-1.5 flex justify-end">
        <button type="button" className="text-sm font-medium text-muted hover:text-ink" onClick={setup}>
          Clear signature
        </button>
      </div>
      <input ref={inputRef} type="hidden" name={name} />
    </div>
  );
}

/* ───────────── Drafts (keeps unsent site forms on the device) ───────────── */

export function DraftKeeper({ storageKey }: { storageKey: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const key = `sdl-draft:${storageKey}`;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null") as Record<string, string> | null;
      if (saved) {
        for (const [k, v] of Object.entries(saved)) {
          const el = form.elements.namedItem(k);
          if (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type !== "hidden" && el.type !== "file")) {
            if (!el.value || el.value === el.defaultValue) el.value = v;
          }
        }
      }
    } catch {}
    const save = () => {
      const data: Record<string, string> = {};
      for (const el of Array.from(form.elements)) {
        if ((el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && ["text", "number"].includes(el.type))) && el.name && el.value)
          data[el.name] = el.value;
      }
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {}
    };
    const clear = () => {
      try {
        localStorage.removeItem(key);
      } catch {}
    };
    form.addEventListener("input", save);
    form.addEventListener("sdl:reset", clear);
    form.addEventListener("sdl:saved", clear);
    return () => {
      form.removeEventListener("input", save);
      form.removeEventListener("sdl:reset", clear);
      form.removeEventListener("sdl:saved", clear);
    };
  }, [storageKey]);
  return <span ref={ref} hidden />;
}

/** Date input that reloads the page for the chosen date (e.g. to edit an earlier daily log). */
export function DateNav({ name, value, max, param = "date" }: { name: string; value: string; max?: string; param?: string }) {
  const router = useRouter();
  return (
    <input
      name={name}
      type="date"
      defaultValue={value}
      max={max}
      className="input"
      onChange={(e) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) router.replace(`?${param}=${e.target.value}`);
      }}
    />
  );
}
