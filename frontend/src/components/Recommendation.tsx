import clsx from "clsx";
import { AlertTriangle, Check, FileCheck2, Hotel, MapPin, Sparkles } from "lucide-react";
import { ReactNode, useState } from "react";
import { MONTHS, Recommendation, TIERS, destByCode, paxText, peso } from "../quote/engine";
import { Tag } from "./ui";

const FIT: Record<string, { text: string; tone: "green" | "gold" | "red" }> = {
  fits: { text: "Fits your budget", tone: "green" }, tight: { text: "Fits at the low end", tone: "gold" }, over: { text: "Over your budget", tone: "red" },
};

export function AiLabel() {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-gold-300"><Sparkles className="h-3.5 w-3.5" />AI recommendation · not yet an offer</span>;
}

export function Verdict({ rec }: { rec: Recommendation }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-ink-950 p-6 text-ivory-50 sm:p-8">
      <div className="glow-orb pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-gold-500/20 blur-3xl" />
      <div className="relative">
        <AiLabel />
        <p className="mt-4 font-display text-2xl font-semibold leading-snug sm:text-[2rem]">{rec.verdict}</p>
        {rec.kind === "priced" && <p className="mt-3 text-sm text-ivory-200/70">{rec.season.label}. Prices are estimates in pesos from sample rates; your travel consultant confirms the final price.</p>}
      </div>
    </div>
  );
}

export function BudgetBox({ rec }: { rec: Recommendation }) {
  const b = rec.budget;
  if (!b) return null;
  if (b.status !== "over") return (
    <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><Check className="mt-0.5 h-4 w-4 shrink-0" /><span>{b.message}</span></div>
  );
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/70 p-5">
      <p className="flex items-start gap-2 text-sm font-medium text-red-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Your budget of {peso(b.budget_total)} is too low for this trip.</p>
      <p className="mt-1 text-sm text-red-900/80">The cheapest version starts at {peso(b.budget_total + b.shortfall)}, so it is {peso(b.shortfall)} short. Here is what would fit:</p>
      <ul className="mt-4 space-y-2">
        {b.ideas.map((i, n) => (
          <li key={n} className={clsx("flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white px-4 py-3", i === b.best ? "border-gold-300 ring-2 ring-gold-100" : "border-ivory-200")}>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink-900">{i.title}{i === b.best && <span className="ml-2 align-middle"><Tag tone="gold">Nearest fit</Tag></span>}</span>
              <span className="block text-xs text-ink-500">{i.detail}</span>
            </span>
            <span className="text-right">
              <span className="block text-sm font-semibold text-ink-900">from {peso(i.total_low)}</span>
              <span className={clsx("block text-xs", i.fits ? "text-emerald-700" : "text-red-700")}>{i.fits ? `${peso(i.diff)} under your budget` : `${peso(-i.diff)} over your budget`}</span>
            </span>
          </li>
        ))}
        {!b.ideas.some((i) => i.fits) && <li className="text-sm text-red-900">Nothing in our sample rates fits yet. A travel consultant can still look for promo fares.</li>}
      </ul>
    </div>
  );
}

export function Compare({ rec, selected, onSelect }: { rec: Recommendation; selected: string; onSelect: (c: string) => void }) {
  const rows: [string, (o: Recommendation["options"][number]) => ReactNode][] = [
    ["Hotel", (o) => `${o.tier_label}, ${o.hotel.nights} nights`],
    ["Area", (o) => o.hotel.area],
    ["Tours", (o) => (o.tours.length ? `${o.tours.length} guided` : "None")],
    ["Per person", (o) => <b className="font-semibold text-ink-900">{peso(o.pp_low)}–{peso(o.pp_high)}</b>],
    ["Total", (o) => `${peso(o.total_low)}–${peso(o.total_high)}`],
  ];
  if (rec.budget) rows.push(["Budget", (o) => o.fit && <Tag tone={FIT[o.fit].tone}>{FIT[o.fit].text}</Tag>]);
  return (
    <div className="card overflow-hidden">
      <table className="w-full table-fixed text-left text-[12px] sm:text-sm">
        <thead>
          <tr>
            <th className="w-[22%] bg-ivory-50 p-2 sm:w-[16%] sm:p-4" />
            {rec.options.map((o) => (
              <th key={o.code} className={clsx("p-2 align-bottom sm:p-4", o.code === selected ? "bg-gold-50" : "bg-ivory-50")}>
                <button className="w-full text-left" onClick={() => onSelect(o.code)}>
                  {o.recommended && <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-700">Best match</span>}
                  <span className="block font-display text-base font-semibold leading-tight text-ink-900 sm:text-xl">{o.label}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, f]) => (
            <tr key={label} className="border-t border-ivory-200">
              <td className="p-2 text-[10px] font-medium uppercase tracking-[0.1em] text-ink-400 sm:p-4 sm:text-[11px]">{label}</td>
              {rec.options.map((o) => <td key={o.code} className={clsx("break-words p-2 align-top text-ink-600 sm:p-4", o.code === selected && "bg-gold-50/60")}>{f(o)}</td>)}
            </tr>
          ))}
          <tr className="border-t border-ivory-200">
            <td className="p-2 sm:p-4" />
            {rec.options.map((o) => (
              <td key={o.code} className={clsx("p-2 sm:p-4", o.code === selected && "bg-gold-50/60")}>
                <button onClick={() => onSelect(o.code)} className={clsx("w-full rounded-full px-2 py-1.5 text-[11px] font-medium transition sm:text-xs", o.code === selected ? "bg-ink-900 text-ivory-50" : "border border-ivory-300 bg-white text-ink-700 hover:border-gold-300")}>{o.code === selected ? "Showing" : "See details"}</button>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function OptionDetail({ rec, code }: { rec: Recommendation; code: string }) {
  const o = rec.options.find((x) => x.code === code)!;
  const pax = rec.input.adults + rec.input.kids;
  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
      <div className="card p-5 sm:p-6">
        <p className="eyebrow">{o.label} · price breakdown</p>
        <p className="mt-1 text-sm text-ink-500">{o.blurb}</p>
        <ul className="mt-4 divide-y divide-ivory-200">
          {o.lines.map((l) => (
            <li key={l.kind} className="flex items-start justify-between gap-4 py-3">
              <span className="min-w-0"><span className="block text-sm font-medium text-ink-900">{l.label}</span><span className="block text-xs text-ink-400">{l.detail}</span></span>
              <span className={clsx("shrink-0 text-right text-sm tabular-nums", l.low < 0 ? "text-emerald-700" : "text-ink-800")}>{peso(l.low)}–{peso(l.high)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-end justify-between gap-4 border-t-2 border-ink-900 pt-4">
          <span className="text-sm text-ink-500">Total for {paxText(rec.input.adults, rec.input.kids)}</span>
          <span className="text-right"><span className="block font-display text-2xl font-semibold text-ink-900">{peso(o.total_low)}–{peso(o.total_high)}</span>{pax > 1 && <span className="text-xs text-ink-400">{peso(o.pp_low)}–{peso(o.pp_high)} per person</span>}</span>
        </div>
      </div>
      <div className="space-y-5">
        <div className="card p-5 sm:p-6">
          <p className="eyebrow flex items-center gap-1.5"><Hotel className="h-3.5 w-3.5" />Where to stay</p>
          <p className="mt-2 font-display text-xl font-semibold text-ink-900">{o.hotel.area}</p>
          <p className="mt-1 text-sm text-ink-500">{o.hotel.why}</p>
          <p className="mt-2 text-xs text-ink-400">{o.hotel.stay} · {TIERS[o.tier].hotel} · {o.hotel.rooms} room{o.hotel.rooms > 1 ? "s" : ""} · sample rate {peso(o.hotel.rate[0])}–{peso(o.hotel.rate[1])} a night</p>
        </div>
        <div className="card p-5 sm:p-6">
          <p className="eyebrow flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Day by day</p>
          <ol className="mt-3 space-y-3">
            {o.itinerary.map((d) => (
              <li key={d.day} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold-50 text-xs font-semibold text-gold-700 ring-1 ring-gold-300/60">{d.day}</span>
                <span className="min-w-0"><span className="block text-sm font-medium text-ink-900">{d.title}</span><span className="block text-xs leading-relaxed text-ink-500">{d.text}</span></span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

export function VisaCard({ rec }: { rec: Recommendation }) {
  if (!rec.visa) return null;
  const d = destByCode(rec.input.destination);
  return (
    <div className="card p-5 sm:p-6">
      <p className="eyebrow flex items-center gap-1.5"><FileCheck2 className="h-3.5 w-3.5" />Visa and documents (Philippine passport)</p>
      <p className="mt-2 font-display text-xl font-semibold text-ink-900">{rec.visa.label}</p>
      <p className="mt-1 text-sm text-ink-500">{rec.visa.note}</p>
      <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {rec.visa.docs.map((x) => <li key={x} className="flex gap-2 text-sm text-ink-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />{x}</li>)}
      </ul>
      <p className="mt-4 rounded-xl bg-ivory-100 px-3 py-2 text-xs text-ink-500">General guide only. Always check the latest requirements with the {d?.domestic ? "airline and local government" : "embassy or official visa centre"} before you apply.</p>
    </div>
  );
}

export function Addons({ rec, selected, onToggle }: { rec: Recommendation; selected: string[]; onToggle?: (code: string) => void }) {
  if (!rec.addons.length) return null;
  const list = onToggle ? rec.addons : rec.addons.filter((a) => selected.includes(a.code));
  if (!list.length) return <p className="text-sm text-ink-400">No add-ons chosen.</p>;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {list.map((a) => {
        const on = selected.includes(a.code);
        return (
          <li key={a.code}>
            <label className={clsx("flex h-full items-start gap-3 rounded-xl border bg-white px-4 py-3 transition", onToggle && "cursor-pointer hover:border-gold-300", on ? "border-gold-300 ring-2 ring-gold-100" : "border-ivory-200")}>
              {onToggle && <input type="checkbox" className="mt-1 h-4 w-4 accent-[#8c6d36]" checked={on} onChange={() => onToggle(a.code)} />}
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-ink-900">{a.label}</span><span className="block text-xs text-ink-400">{a.detail} · {a.unit}</span></span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-800">+{peso(a.price)}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export function Assumptions({ rec }: { rec: Recommendation }) {
  if (!rec.assumptions.length) return null;
  return (
    <div className="rounded-2xl border border-ivory-300 bg-white/60 px-5 py-4 text-sm text-ink-500">
      <p className="mb-1 font-medium text-ink-700">What the AI assumed</p>
      <ul className="list-disc space-y-0.5 pl-5">{rec.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
    </div>
  );
}

/** Whole recommendation, used on the customer page and on the staff request page. */
export default function RecommendationView({ rec, addons, onToggleAddon }: { rec: Recommendation; addons: string[]; onToggleAddon?: (c: string) => void }) {
  const [sel, setSel] = useState(rec.recommended ?? "value");
  const code = rec.options.some((o) => o.code === sel) ? sel : rec.recommended ?? "value";
  return (
    <div className="space-y-5">
      <Verdict rec={rec} />
      <BudgetBox rec={rec} />
      {rec.kind === "priced" && (
        <>
          <div className="stagger space-y-5">
            <Compare rec={rec} selected={code} onSelect={setSel} />
            <OptionDetail rec={rec} code={code} />
          </div>
          <VisaCard rec={rec} />
          <div className="card p-5 sm:p-6">
            <p className="eyebrow">Optional add-ons</p>
            <p className="mb-3 mt-1 text-sm text-ink-500">{onToggleAddon ? "Tick anything you'd like included in your offer." : "Add-ons the customer asked for."}</p>
            <Addons rec={rec} selected={addons} onToggle={onToggleAddon} />
          </div>
        </>
      )}
      <Assumptions rec={rec} />
      <p className="text-xs text-ink-400">{rec.notice}{rec.input.month ? ` Travel month used: ${MONTHS[rec.input.month - 1]}.` : ""}</p>
    </div>
  );
}
