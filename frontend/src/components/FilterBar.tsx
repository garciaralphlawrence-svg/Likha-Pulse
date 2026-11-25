import { useState } from "react";
import type { Filters } from "../api/types";
import { EMOTIONS, INTENTS, TOPICS } from "../demo/engine";
import { isoDay, presetRange } from "../lib/format";
import { Select } from "./ui";

export const PLATFORMS = [
  { value: "google_business", label: "Google Business Profile" }, { value: "facebook_page", label: "Facebook comments" },
  { value: "messenger", label: "Messenger" }, { value: "manual", label: "Manual entry" },
];
const PRESETS = [{ d: 7, l: "7 days" }, { d: 30, l: "30 days" }, { d: 90, l: "90 days" }, { d: 365, l: "1 year" }];

export function useFilters(initial: Filters = presetRange(30)) {
  const [f, setF] = useState<Filters>(initial);
  const set = (k: keyof Filters, v: string | boolean | undefined) => setF((p) => ({ ...p, [k]: v === "" ? undefined : v }));
  return { f, setF, set };
}

type Field = "platform" | "sentiment" | "priority" | "emotion" | "intent" | "topic" | "review" | "action" | "search";

export default function FilterBar({ f, set, setF, fields = ["platform", "sentiment"] }: { f: Filters; set: (k: keyof Filters, v: string | boolean | undefined) => void; setF: (f: Filters) => void; fields?: Field[] }) {
  const active = PRESETS.find((p) => f.date_from === presetRange(p.d).date_from && f.date_to === isoDay(new Date()));
  return (
    <div className="card mb-5 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="label">Period</span>
          <div className="flex max-w-full overflow-x-auto rounded-lg border border-slate-300">
            {PRESETS.map((p) => (
              <button key={p.d} type="button" onClick={() => setF({ ...f, ...presetRange(p.d) })}
                className={`whitespace-nowrap px-3 py-2 text-sm ${active?.d === p.d ? "bg-navy-900 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>{p.l}</button>
            ))}
            <button type="button" onClick={() => setF({ ...f, date_from: "2000-01-01", date_to: isoDay(new Date()) })}
              className={`whitespace-nowrap px-3 py-2 text-sm ${f.date_from === "2000-01-01" ? "bg-navy-900 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>All</button>
          </div>
        </div>
        <label><span className="label">From</span><input type="date" className="input" value={f.date_from?.slice(0, 10) ?? ""} onChange={(e) => set("date_from", e.target.value)} /></label>
        <label><span className="label">To</span><input type="date" className="input" value={f.date_to?.slice(0, 10) ?? ""} onChange={(e) => set("date_to", e.target.value)} /></label>
        {fields.includes("platform") && <div className="w-48"><Select label="Platform" value={f.platform ?? ""} onChange={(v) => set("platform", v)} options={PLATFORMS} /></div>}
        {fields.includes("sentiment") && <div className="w-36"><Select label="Sentiment" value={f.sentiment ?? ""} onChange={(v) => set("sentiment", v)} options={["positive", "neutral", "negative"]} /></div>}
        {fields.includes("priority") && <div className="w-36"><Select label="Priority" value={f.priority ?? ""} onChange={(v) => set("priority", v)} options={["critical", "high", "medium", "low"]} /></div>}
        {fields.includes("emotion") && <div className="w-40"><Select label="Emotion" value={f.emotion ?? ""} onChange={(v) => set("emotion", v)} options={EMOTIONS} /></div>}
        {fields.includes("intent") && <div className="w-44"><Select label="Intent" value={f.intent ?? ""} onChange={(v) => set("intent", v)} options={INTENTS} /></div>}
        {fields.includes("topic") && <div className="w-48"><Select label="Topic" value={f.topic ?? ""} onChange={(v) => set("topic", v)} options={TOPICS.map((t) => ({ value: t, label: t }))} /></div>}
        {fields.includes("review") && <div className="w-40"><Select label="Review" value={f.review ?? ""} onChange={(v) => set("review", v)} options={[{ value: "unreviewed", label: "Unreviewed" }, { value: "pending_review", label: "Pending review" }, { value: "reviewed", label: "Reviewed" }]} /></div>}
        {fields.includes("action") && <div className="w-40"><Select label="Action" value={f.action ?? ""} onChange={(v) => set("action", v)} options={[{ value: "open", label: "Open" }, { value: "pending_action", label: "Pending action" }, { value: "resolved", label: "Resolved" }]} /></div>}
        {fields.includes("search") && <label className="min-w-[200px] flex-1"><span className="label">Search text</span><input className="input" placeholder="e.g. refund, tagal, rude" value={f.search ?? ""} onChange={(e) => set("search", e.target.value)} /></label>}
      </div>
    </div>
  );
}
