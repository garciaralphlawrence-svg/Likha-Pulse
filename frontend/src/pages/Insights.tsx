import { AlertCircle, Heart, ListChecks, RefreshCw, Repeat, Sparkles, ThumbsDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import type { Insight } from "../api/types";
import FilterBar, { useFilters } from "../components/FilterBar";
import { Empty, ErrorBox, PageHeader, Spinner } from "../components/ui";
import { useAuth } from "../lib/auth";
import { fmtDate } from "../lib/format";
import { useAsync } from "../lib/useAsync";

const SECTIONS: [keyof Insight["summary"], string, JSX.Element][] = [
  ["positives", "What customers love", <Heart className="h-4 w-4" />],
  ["complaints", "What they complain about", <ThumbsDown className="h-4 w-4" />],
  ["emerging", "New issues to watch", <AlertCircle className="h-4 w-4" />],
  ["recurring", "Problems that keep coming back", <Repeat className="h-4 w-4" />],
  ["trend", "Better or worse?", <TrendingUp className="h-4 w-4" />],
];

function Letter({ ins }: { ins: Insight }) {
  return (
    <article className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-ink-950 p-8 text-ivory-100 shadow-lift">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-gold-500/15 blur-3xl" />
        <p className="relative flex items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-gold-300"><Sparkles className="h-3.5 w-3.5" />In short · {fmtDate(ins.period.from, false)} – {fmtDate(ins.period.to, false)}</p>
        <p className="relative mt-3 font-display text-[27px] leading-snug text-ivory-50">{ins.summary.overall}</p>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map(([k, title, icon]) => ins.summary[k] && (
          <div key={k} className="card p-6">
            <p className="flex items-center gap-2 text-gold-700">{icon}<span className="eyebrow">{title}</span></p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-800">{ins.summary[k]}</p>
          </div>
        ))}
      </div>
      <section className="rounded-3xl border border-gold-300/60 bg-gold-50 p-7">
        <p className="flex items-center gap-2 text-gold-700"><ListChecks className="h-5 w-5" /><span className="font-display text-2xl font-semibold text-ink-900">What you should do</span></p>
        <ol className="mt-3 space-y-2">
          {(ins.summary.actions.includes("\n") ? ins.summary.actions.split("\n") : ins.summary.actions.split(/(?<=\.)\s+/)).filter(Boolean).map((a, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink-800"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-900 text-xs font-semibold text-gold-300">{i + 1}</span>{a}</li>
          ))}
        </ol>
      </section>
    </article>
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
      <PageHeader eyebrow="AI Summary" title="Everything your customers said, in one page" description="The AI reads all messages in the period you choose and tells you what's going well, what's wrong, and what to do."
        actions={can("insights.generate") && <button className="btn-gold" onClick={gen} disabled={busy}><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />{busy ? "Reading messages…" : "Make a new summary"}</button>} />
      <FilterBar f={f} set={set} setF={setF} fields={["platform"]} />
      <ErrorBox error={err} />
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div>{busy ? <Spinner label="Reading all messages…" /> : shown ? <Letter ins={shown} /> : <Empty title="No summary yet">Pick a time period above and click “Make a new summary”.</Empty>}</div>
        <aside className="card h-fit p-5">
          <p className="eyebrow mb-3">Past summaries</p>
          {list.loading ? <Spinner /> : !list.data?.length ? <p className="text-sm text-ink-400">None yet.</p> : (
            <ul className="space-y-1">
              {list.data.map((i) => (
                <li key={i.id}><button onClick={() => setCurrent(i)} className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-ivory-100 ${shown?.id === i.id ? "bg-gold-50 font-medium text-ink-900 ring-1 ring-gold-300/60" : "text-ink-600"}`}>
                  {fmtDate(i.period.from, false)} – {fmtDate(i.period.to, false)}<span className="block text-xs text-ink-400">made {fmtDate(i.created_at)}</span></button></li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}
