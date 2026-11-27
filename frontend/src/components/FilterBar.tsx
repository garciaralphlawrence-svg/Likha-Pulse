import { Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { Filters } from "../api/types";
import { EMOTIONS, INTENTS, TOPICS } from "../demo/engine";
import { FEELING, PURPOSE, isoDay, presetRange } from "../lib/format";
import { Select } from "./ui";

export const PLATFORMS = [
  { value: "facebook_page", label: "Facebook Comments" }, { value: "messenger", label: "Messenger Chats" },
  { value: "manual", label: "Added by staff" }, { value: "import", label: "Imported" },
];
const PRESETS = [{ d: 7, l: "This week" }, { d: 30, l: "This month" }, { d: 90, l: "3 months" }, { d: 365, l: "This year" }];

export function useFilters(initial: Filters = presetRange(30)) {
  const [f, setF] = useState<Filters>(initial);
  const set = (k: keyof Filters, v: string | boolean | undefined) => setF((p) => ({ ...p, [k]: v === "" ? undefined : v }));
  return { f, setF, set };
}

type Field = "platform" | "sentiment" | "priority" | "emotion" | "intent" | "topic" | "review" | "action" | "search";

export default function FilterBar({ f, set, setF, fields = ["platform", "sentiment"] }: { f: Filters; set: (k: keyof Filters, v: string | boolean | undefined) => void; setF: (f: Filters) => void; fields?: Field[] }) {
  const [more, setMore] = useState(false);
  const active = PRESETS.find((p) => f.date_from === presetRange(p.d).date_from && f.date_to === isoDay(new Date()));
  const extra = fields.filter((x) => ["emotion", "intent", "topic", "review", "action"].includes(x));
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex max-w-full overflow-x-auto rounded-full border border-ivory-300 bg-white p-1">
          {PRESETS.map((p) => (
            <button key={p.d} type="button" onClick={() => setF({ ...f, ...presetRange(p.d) })}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition ${active?.d === p.d ? "bg-ink-900 text-ivory-50" : "text-ink-500 hover:text-ink-900"}`}>{p.l}</button>
          ))}
          <button type="button" onClick={() => setF({ ...f, date_from: "2000-01-01", date_to: isoDay(new Date()) })}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition ${f.date_from === "2000-01-01" ? "bg-ink-900 text-ivory-50" : "text-ink-500 hover:text-ink-900"}`}>All time</button>
        </div>
        {fields.includes("platform") && <div className="w-52"><Select value={f.platform ?? ""} onChange={(v) => set("platform", v)} options={PLATFORMS} placeholder="All sources" /></div>}
        {fields.includes("sentiment") && <div className="w-40"><Select value={f.sentiment ?? ""} onChange={(v) => set("sentiment", v)} options={[{ value: "positive", label: "Happy" }, { value: "neutral", label: "Neutral" }, { value: "negative", label: "Unhappy" }]} placeholder="Any mood" /></div>}
        {fields.includes("priority") && <div className="w-40"><Select value={f.priority ?? ""} onChange={(v) => set("priority", v)} options={[{ value: "critical", label: "Urgent" }, { value: "high", label: "Important" }, { value: "medium", label: "Follow up" }, { value: "low", label: "No rush" }]} placeholder="Any urgency" /></div>}
        {fields.includes("search") && (
          <label className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input className="input rounded-full pl-10" placeholder="Search messages…" value={f.search ?? ""} onChange={(e) => set("search", e.target.value)} aria-label="Search messages" />
          </label>
        )}
        {extra.length > 0 && <button type="button" className="btn-secondary" onClick={() => setMore(!more)}><SlidersHorizontal className="h-4 w-4" />{more ? "Fewer filters" : "More filters"}</button>}
      </div>
      {more && (
        <div className="card mt-3 grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
          {fields.includes("emotion") && <Select label="Feeling" value={f.emotion ?? ""} onChange={(v) => set("emotion", v)} options={EMOTIONS.map((e) => ({ value: e, label: FEELING[e] }))} placeholder="Any" />}
          {fields.includes("intent") && <Select label="Type of message" value={f.intent ?? ""} onChange={(v) => set("intent", v)} options={INTENTS.map((i) => ({ value: i, label: PURPOSE[i] }))} placeholder="Any" />}
          {fields.includes("topic") && <Select label="About" value={f.topic ?? ""} onChange={(v) => set("topic", v)} options={TOPICS.map((t) => ({ value: t, label: t }))} placeholder="Anything" />}
          {fields.includes("review") && <Select label="Checked by team" value={f.review ?? ""} onChange={(v) => set("review", v)} options={[{ value: "pending_review", label: "Please double-check" }, { value: "unreviewed", label: "Not yet checked" }, { value: "reviewed", label: "Checked" }]} placeholder="Any" />}
          {fields.includes("action") && <Select label="Status" value={f.action ?? ""} onChange={(v) => set("action", v)} options={[{ value: "unresolved", label: "Not yet done" }, { value: "pending_action", label: "To do" }, { value: "resolved", label: "Done" }]} placeholder="Any" />}
          <div className="grid grid-cols-2 gap-2 lg:col-span-5">
            <label><span className="label">From</span><input type="date" className="input" value={f.date_from?.slice(0, 10) ?? ""} onChange={(e) => set("date_from", e.target.value)} /></label>
            <label><span className="label">To</span><input type="date" className="input" value={f.date_to?.slice(0, 10) ?? ""} onChange={(e) => set("date_to", e.target.value)} /></label>
          </div>
        </div>
      )}
    </div>
  );
}
