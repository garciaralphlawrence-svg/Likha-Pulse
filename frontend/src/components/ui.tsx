import clsx from "clsx";
import { Loader2, X } from "lucide-react";
import { ReactNode, useEffect } from "react";
import { MOOD, PRIO_COLORS, SENT_COLORS, URGENCY, label, pretty, sureness } from "../lib/format";

export function Card({ title, subtitle, action, children, className }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("card", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5">
          <div>
            {title && <h2 className="font-display text-xl font-semibold text-ink-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-6 pt-4">{children}</div>
    </section>
  );
}

export function SentimentBadge({ value }: { value?: string | null; score?: number | null }) {
  if (!value) return <span className="text-ink-400">—</span>;
  const c = SENT_COLORS[value] ?? "#8a8f99";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: c + "14", color: c }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />{label(MOOD, value)}
    </span>
  );
}

export function PriorityBadge({ value }: { value?: string | null }) {
  if (!value) return <span className="text-ink-400">—</span>;
  const c = PRIO_COLORS[value] ?? "#8a8f99";
  return <span className="inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: c, borderColor: c + "40", background: c + "0d" }}>{label(URGENCY, value)}</span>;
}

export function Tag({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "amber" | "blue" | "red" | "green" | "gold" }) {
  const tones = {
    slate: "bg-ivory-100 text-ink-500", amber: "bg-gold-50 text-gold-700 ring-1 ring-gold-100", blue: "bg-ivory-100 text-ink-700",
    red: "bg-red-50 text-red-800", green: "bg-emerald-50 text-emerald-800", gold: "bg-gold-50 text-gold-700 ring-1 ring-gold-300/60",
  };
  return <span className={clsx("inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", tones[tone])}>{children}</span>;
}

export const SampleTag = () => <Tag tone="amber">Sample</Tag>;

export function SureTag({ value }: { value: number }) {
  const t = sureness(value);
  return <Tag tone={value >= 0.7 ? "slate" : "gold"}>{t}</Tag>;
}
export const ConfidenceBar = SureTag;

export function Spinner({ label: l = "Loading…" }: { label?: string }) {
  return <div className="flex items-center gap-2 p-8 text-sm text-ink-400"><Loader2 className="h-4 w-4 animate-spin text-gold-500" />{l}</div>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-ivory-300 p-10 text-center"><p className="font-display text-lg text-ink-800">{title}</p>{children && <div className="mt-1 text-sm text-ink-400">{children}</div>}</div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return <div role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{error instanceof Error ? error.message : String(error)}</div>;
}

export function Select({ label: l, value, onChange, options, placeholder = "All" }: { label?: string; value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; placeholder?: string | null }) {
  return (
    <label className="block min-w-0">
      {l && <span className="label">{l}</span>}
      <select className="input pr-8" value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder !== null && <option value="">{placeholder}</option>}
        {options.map((o) => typeof o === "string" ? <option key={o} value={o}>{pretty(o)}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Drawer({ open, onClose, title, children, width = "max-w-xl" }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={clsx("relative flex h-full w-full flex-col bg-ivory-50 shadow-lift", width)} style={{ animation: "slideIn .45s cubic-bezier(.2,.7,.2,1) both" }}>
        <div className="flex items-center justify-between border-b border-ivory-200 px-6 py-4">
          <h2 className="font-display text-2xl font-semibold text-ink-900">{title}</h2>
          <button className="btn-ghost p-2" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-ivory-50 p-6 shadow-lift">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl font-semibold">{title}</h2><button className="btn-ghost p-1.5" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="font-display text-4xl font-semibold leading-tight text-ink-900">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
