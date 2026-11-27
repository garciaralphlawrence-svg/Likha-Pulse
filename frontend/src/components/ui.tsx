import clsx from "clsx";
import { Loader2, X } from "lucide-react";
import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { STATUS_TONE } from "../lib/format";
import { STATUSES, Status } from "../quote/workflow";

export function Card({ title, subtitle, action, children, className }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("card", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
          <div className="min-w-0">
            {title && <h2 className="font-display text-xl font-semibold text-ink-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5 pt-4 sm:p-6 sm:pt-4">{children}</div>
    </section>
  );
}

export type Tone = "slate" | "gold" | "blue" | "red" | "green";
export function Tag({ children, tone = "slate", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  const tones: Record<Tone, string> = {
    slate: "bg-ivory-100 text-ink-500", gold: "bg-gold-50 text-gold-700 ring-1 ring-gold-300/60", blue: "bg-sky-50 text-sky-900 ring-1 ring-sky-200",
    red: "bg-red-50 text-red-800 ring-1 ring-red-200", green: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  };
  return <span className={clsx("inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium", tones[tone], className)}>{children}</span>;
}
export const SampleTag = () => <Tag tone="gold">Sample</Tag>;
export const StatusBadge = ({ status }: { status: Status }) => <Tag tone={STATUS_TONE[status]}>{STATUSES[status].staff}</Tag>;

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <div className="flex items-center gap-2 p-8 text-sm text-ink-400"><Loader2 className="h-4 w-4 animate-spin text-gold-500" />{label}</div>;
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-ivory-300 p-8 text-center sm:p-10"><p className="font-display text-lg text-ink-800">{title}</p>{children && <div className="mt-1 text-sm text-ink-400">{children}</div>}</div>;
}
export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return <div role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{error instanceof Error ? error.message : String(error)}</div>;
}
export function Select({ label, value, onChange, options, placeholder = "All" }: { label?: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string | null }) {
  return (
    <label className="block min-w-0">
      {label && <span className="label">{label}</span>}
      <select className="input pr-8" value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder !== null && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-ivory-50 p-6 shadow-lift sm:rounded-2xl" style={{ animation: "fadeUp .35s cubic-bezier(.2,.7,.2,1) both" }}>
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-display text-2xl font-semibold">{title}</h2><button className="btn-ghost p-1.5" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>, document.body,
  );
}
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-semibold leading-tight text-ink-900 sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "gold" | "red" }) {
  return (
    <div className="card p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">{label}</p>
      <p className={clsx("mt-2 font-display text-3xl font-semibold", tone === "red" ? "text-red-800" : tone === "gold" ? "text-gold-700" : "text-ink-900")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}
