// Small, dependency-free charts for the owner pages. Mood colors form a diverging set
// (green = happy, warm gray = neutral midpoint, red = unhappy); numbers are always shown next to them.
import clsx from "clsx";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import type { OwnerFilters, OwnerReport } from "../api/types";
import { voicesCsv, type Range } from "../quote/owner";

export const MOOD_COLOR = { positive: "#24835e", neutral: "#b3aa9a", negative: "#b84c40" } as const;
const MOOD_WORD = { positive: "Happy", neutral: "Neutral", negative: "Unhappy" } as const;

export function MoodLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500" aria-label="Legend">
      {(Object.keys(MOOD_COLOR) as (keyof typeof MOOD_COLOR)[]).map((k) => <li key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: MOOD_COLOR[k] }} />{MOOD_WORD[k]}</li>)}
    </ul>
  );
}

/** One horizontal stacked bar: happy / neutral / unhappy, with a 2px gap between segments. */
export function MoodBar({ positive, neutral, negative, label }: { positive: number; neutral: number; negative: number; label: string }) {
  const total = positive + neutral + negative || 1;
  const parts = ([["positive", positive], ["neutral", neutral], ["negative", negative]] as const).filter(([, n]) => n > 0);
  return (
    <div className="flex h-3 w-full gap-[2px]" role="img" aria-label={`${label}: ${positive} happy, ${neutral} neutral, ${negative} unhappy`}>
      {parts.map(([k, n], i) => (
        <div key={k} title={`${label}: ${n} ${MOOD_WORD[k].toLowerCase()} (${Math.round((n / total) * 100)}%)`} className={clsx("bar-grow h-full transition-opacity hover:opacity-80", i === 0 && "rounded-l", i === parts.length - 1 && "rounded-r")}
          style={{ width: `${(n / total) * 100}%`, background: MOOD_COLOR[k], animationDelay: `${i * 0.05}s` }} />
      ))}
    </div>
  );
}

/** Stacked columns over time (one per week or month). */
export function TrendColumns({ items }: { items: { period: string; label: string; positive: number; neutral: number; negative: number; count: number }[] }) {
  const max = Math.max(1, ...items.map((x) => x.count));
  return (
    <div>
      <div className="flex h-44 items-end gap-2 border-b border-ivory-300 sm:gap-3">
        {items.map((x, i) => (
          <div key={x.period} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${x.label}: ${x.positive} happy, ${x.neutral} neutral, ${x.negative} unhappy`}>
            <span className="mb-1 text-center text-[11px] tabular-nums text-ink-500">{x.count}</span>
            <div className="flex flex-col-reverse gap-[2px] overflow-hidden rounded-t" style={{ height: `${(x.count / max) * 100}%`, animation: `fadeUp .7s cubic-bezier(.2,.7,.2,1) ${i * 0.05}s both` }}>
              {(["positive", "neutral", "negative"] as const).map((k) => x[k] > 0 && <div key={k} className="w-full group-hover:opacity-85" style={{ flexGrow: x[k], background: MOOD_COLOR[k] }} />)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">{items.map((x) => <span key={x.period} className="min-w-0 flex-1 truncate text-center text-[10px] text-ink-400 sm:text-[11px]">{x.label.replace("Week of ", "")}</span>)}</div>
    </div>
  );
}

/** Single-series horizontal bars with the value printed (gold = money or counts). */
export function ValueBars({ items, format = (n: number) => String(n) }: { items: { label: string; value: number; hint?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...items.map((x) => x.value));
  return (
    <ul className="space-y-3">
      {items.map((x, i) => (
        <li key={x.label} title={`${x.label}: ${format(x.value)}${x.hint ? ` · ${x.hint}` : ""}`}>
          <div className="flex justify-between gap-3 text-sm"><span className="min-w-0 truncate text-ink-700">{x.label}</span><span className="shrink-0 tabular-nums text-ink-800">{format(x.value)}</span></div>
          {x.hint && <p className="text-[11px] text-ink-400">{x.hint}</p>}
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-ivory-200"><div className="bar-grow h-full rounded-full bg-gradient-to-r from-gold-700 to-gold-300" style={{ width: `${(x.value / max) * 100}%`, animationDelay: `${i * 0.05}s` }} /></div>
        </li>
      ))}
    </ul>
  );
}

// ---------- filters shared by the owner pages (kept for this browser tab) ----------
const FKEY = "paph.owner.filters";
const DEFAULT: OwnerFilters = { range: "90", destination: "", salesperson: "" };
export function useOwnerFilters(): [OwnerFilters, (f: OwnerFilters) => void] {
  const [f, setF] = useState<OwnerFilters>(() => { try { return { ...DEFAULT, ...JSON.parse(sessionStorage.getItem(FKEY) ?? "{}") }; } catch { return DEFAULT; } });
  useEffect(() => { try { sessionStorage.setItem(FKEY, JSON.stringify(f)); } catch { /* ignore */ } }, [f]);
  return [f, setF];
}
const RANGES: { v: Range; label: string }[] = [{ v: "30", label: "30 days" }, { v: "90", label: "90 days" }, { v: "year", label: "This year" }, { v: "all", label: "All time" }];

export function OwnerFilterBar({ f, onChange, report }: { f: OwnerFilters; onChange: (f: OwnerFilters) => void; report: OwnerReport | null }) {
  const exportCsv = () => {
    if (!report) return;
    const blob = new Blob(["﻿" + voicesCsv(report.voices)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `paph-customer-sentiment-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-ivory-300 bg-white p-1" role="group" aria-label="Date range">
        {RANGES.map((r) => <button key={r.v} onClick={() => onChange({ ...f, range: r.v })} className={clsx("shrink-0 rounded-full px-3 py-1.5 text-sm transition", f.range === r.v ? "bg-ink-900 text-ivory-50" : "text-ink-500 hover:text-ink-900")}>{r.label}</button>)}
      </div>
      <select className="input w-auto min-w-0 max-w-full py-2" aria-label="Destination" value={f.destination} onChange={(e) => onChange({ ...f, destination: e.target.value })}>
        <option value="">All destinations</option>
        {report?.options.destinations.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
      </select>
      <select className="input w-auto min-w-0 max-w-full py-2" aria-label="Salesperson" value={f.salesperson} onChange={(e) => onChange({ ...f, salesperson: e.target.value })}>
        <option value="">All salespeople</option>
        {report?.options.salespeople.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <button className="btn-secondary ml-auto" onClick={exportCsv} disabled={!report}><Download className="h-4 w-4" />Export CSV</button>
    </div>
  );
}
