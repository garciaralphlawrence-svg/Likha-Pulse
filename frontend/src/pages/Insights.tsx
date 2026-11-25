import { Brain } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import type { Insight } from "../api/types";
import FilterBar, { useFilters } from "../components/FilterBar";
import { Card, Empty, ErrorBox, PageHeader, Spinner, Tag } from "../components/ui";
import { useAuth } from "../lib/auth";
import { fmtDate } from "../lib/format";
import { useAsync } from "../lib/useAsync";

const SECTIONS: [keyof Insight["summary"], string][] = [
  ["overall", "Overall public sentiment"], ["positives", "Most common positive feedback"], ["complaints", "Most common complaints"],
  ["emerging", "Emerging issues"], ["recurring", "Recurring concerns"], ["trend", "Changes in sentiment over time"], ["actions", "Suggested management actions"],
];

function InsightView({ ins }: { ins: Insight }) {
  const a = ins.aggregates;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>{fmtDate(ins.period.from, false)} – {fmtDate(ins.period.to, false)}</span><span>· generated {fmtDate(ins.created_at)}</span>
        <Tag tone={ins.engine === "claude" ? "blue" : "slate"}>{ins.engine === "claude" ? "Written by Claude from the aggregates" : "Rule-based, from the aggregates"}</Tag>
        {Object.entries(ins.filters ?? {}).map(([k, v]) => <Tag key={k}>{k}: {String(v)}</Tag>)}
      </div>
      {SECTIONS.map(([k, label]) => ins.summary[k] && (
        <div key={k} className={k === "actions" ? "rounded-lg bg-navy-50 p-4" : ""}>
          <h3 className={`mb-1 text-xs font-semibold uppercase ${k === "actions" ? "text-navy-700" : "text-slate-500"}`}>{label}</h3>
          <p className="text-sm leading-relaxed text-slate-700">{ins.summary[k]}</p>
        </div>
      ))}
      {a?.current && (
        <details className="rounded-lg border border-slate-200 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-slate-700">Numbers behind this summary</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div><b>This period:</b> {a.current.total} items, {a.current.negative_pct}% negative, avg {a.current.average_score}</div>
            <div><b>Previous period:</b> {a.previous.total} items, {a.previous.negative_pct}% negative, avg {a.previous.average_score}</div>
            <div><b>Help / follow-up requests:</b> {a.assistance_requests}</div>
            <div><b>Top complaints:</b> {a.top_complaints.map((t: any) => `${t.topic} (${t.count})`).join(", ") || "—"}</div>
            <div><b>Most appreciated:</b> {a.most_appreciated.map((t: any) => `${t.topic} (${t.count})`).join(", ") || "—"}</div>
            <div><b>Emerging:</b> {a.emerging.map((e: any) => `${e.topic} ${e.before}→${e.now}`).join(", ") || "—"}</div>
          </div>
        </details>
      )}
    </div>
  );
}

export default function Insights() {
  const { f, set, setF } = useFilters();
  const { can } = useAuth();
  const list = useAsync(() => api.insights(), []);
  const [current, setCurrent] = useState<Insight | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const shown = current ?? list.data?.[0] ?? null;
  const gen = async () => {
    setBusy(true); setErr(null);
    try { const i = await api.generateInsight(f); setCurrent(i); list.reload(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="AI Insights" description="Recurring themes, emerging issues and recommended actions, computed from the analyzed feedback in the period you choose. The text never contains figures that are not in the data."
        actions={can("insights.generate") && <button className="btn-primary" onClick={gen} disabled={busy}><Brain className="h-4 w-4" />{busy ? "Analyzing…" : "Generate new analysis"}</button>} />
      <FilterBar f={f} set={set} setF={setF} fields={["platform"]} />
      <ErrorBox error={err} />
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <Card title="Insight report">{busy ? <Spinner label="Analyzing feedback…" /> : shown ? <InsightView ins={shown} /> : <Empty title="No insights yet">Choose a period and click “Generate new analysis”.</Empty>}</Card>
        <Card title="Previous analyses">
          {list.loading ? <Spinner /> : !list.data?.length ? <p className="text-sm text-slate-500">None yet.</p> : (
            <ul className="space-y-1">
              {list.data.map((i) => (
                <li key={i.id}><button onClick={() => setCurrent(i)} className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 ${shown?.id === i.id ? "bg-navy-50 font-medium" : ""}`}>
                  {fmtDate(i.period.from, false)} – {fmtDate(i.period.to, false)}<span className="block text-xs text-slate-500">{fmtDate(i.created_at)}</span></button></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
