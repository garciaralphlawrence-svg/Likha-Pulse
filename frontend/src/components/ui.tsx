import clsx from "clsx";
import { Loader2, X } from "lucide-react";
import { ReactNode, useEffect } from "react";
import { PRIO_COLORS, SENT_COLORS, pretty } from "../lib/format";

export function Card({ title, subtitle, action, children, className }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("card", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5 pt-3">{children}</div>
    </section>
  );
}

export function SentimentBadge({ value, score }: { value?: string | null; score?: number | null }) {
  if (!value) return <span className="text-slate-400">—</span>;
  const c = SENT_COLORS[value] ?? "#64748b";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: c + "18", color: c }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {pretty(value)}{score !== undefined && score !== null && <span className="opacity-70">{score > 0 ? `+${score}` : score}</span>}
    </span>
  );
}

export function PriorityBadge({ value }: { value?: string | null }) {
  if (!value) return <span className="text-slate-400">—</span>;
  const c = PRIO_COLORS[value] ?? "#64748b";
  return <span className="inline-flex rounded-md border px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide" style={{ color: c, borderColor: c + "55", background: c + "10" }}>{value}</span>;
}

export function Tag({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "amber" | "blue" | "red" | "green" }) {
  const tones = { slate: "bg-slate-100 text-slate-700", amber: "bg-amber-50 text-amber-800 ring-1 ring-amber-200", blue: "bg-blue-50 text-blue-700", red: "bg-red-50 text-red-700", green: "bg-emerald-50 text-emerald-700" };
  return <span className={clsx("inline-flex shrink-0 items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium", tones[tone])}>{children}</span>;
}

export const SampleTag = () => <Tag tone="amber">Sample data</Tag>;

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{label}</div>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center"><p className="text-sm font-medium text-slate-700">{title}</p>{children && <div className="mt-1 text-sm text-slate-500">{children}</div>}</div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error instanceof Error ? error.message : String(error)}</div>;
}

export function Select({ label, value, onChange, options, placeholder = "All" }: { label?: string; value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; placeholder?: string | null }) {
  return (
    <label className="block min-w-0">
      {label && <span className="label">{label}</span>}
      <select className="input pr-8" value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder !== null && <option value="">{placeholder}</option>}
        {options.map((o) => typeof o === "string" ? <option key={o} value={o}>{pretty(o)}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Drawer({ open, onClose, title, children, width = "max-w-2xl" }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className={clsx("relative flex h-full w-full flex-col bg-white shadow-xl", width)}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button className="btn-ghost p-1.5" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold">{title}</h2><button className="btn-ghost p-1" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-semibold text-slate-900">{title}</h1>{description && <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ConfidenceBar({ value, high = 0.9, moderate = 0.7 }: { value: number; high?: number; moderate?: number }) {
  const color = value >= high ? "#1f9d6b" : value >= moderate ? "#d4a017" : "#d64545";
  return (
    <span className="inline-flex items-center gap-2" title={value >= high ? "High confidence" : value >= moderate ? "Moderate confidence" : "Low confidence: manual review recommended"}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full" style={{ width: `${value * 100}%`, background: color }} /></span>
      <span className="text-xs tabular-nums text-slate-600">{Math.round(value * 100)}%</span>
    </span>
  );
}
