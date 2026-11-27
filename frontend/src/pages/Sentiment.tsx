import { Star } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { MOOD_COLOR, MoodBar, MoodLegend, OwnerFilterBar, TrendColumns, useOwnerFilters } from "../components/charts";
import { Card, Empty, ErrorBox, PageHeader, SampleTag, Spinner, Stat, Tag } from "../components/ui";
import { fmtDate } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import type { Slice, Voice } from "../quote/owner";

const MOOD_TONE = { positive: "green", neutral: "slate", negative: "red" } as const;
const MOOD_WORD = { positive: "Happy", neutral: "Neutral", negative: "Unhappy" } as const;

function Quote({ v, onCase }: { v: Voice; onCase?: (v: Voice) => void }) {
  return (
    <li className="rounded-xl border border-ivory-200 bg-white p-4">
      <p className="font-display text-lg italic leading-snug text-ink-800">“{v.text}”</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-400">
        <Tag tone={MOOD_TONE[v.mood]}>{MOOD_WORD[v.mood]}</Tag>
        {v.rating && <span className="flex items-center gap-0.5 text-gold-700">{Array.from({ length: v.rating }, (_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}</span>}
        <span>{v.kind_label} · {v.customer} · {v.destination_name} · {fmtDate(v.at, false)}</span>
        {v.request_id ? <Link className="font-medium text-gold-700 underline-offset-2 hover:underline" to={`/staff/requests/${v.request_id}`}>{v.ref}</Link> : <Link className="font-medium text-gold-700 hover:underline" to="/staff/inbox">Inbox</Link>}
        {v.is_sample && <SampleTag />}
        {onCase && <button className="ml-auto rounded-full border border-red-200 px-2.5 py-0.5 text-xs font-medium text-red-800 hover:bg-red-50" onClick={() => onCase(v)}>Open a case</button>}
      </div>
    </li>
  );
}

function Slices({ items }: { items: Slice[] }) {
  if (!items.length) return <p className="text-sm text-ink-400">No messages for these filters.</p>;
  return (
    <ul className="space-y-3.5">
      {items.slice(0, 8).map((s) => (
        <li key={s.key}>
          <div className="mb-1 flex justify-between gap-3 text-sm"><span className="min-w-0 truncate text-ink-700">{s.label}</span><span className="shrink-0 text-xs tabular-nums text-ink-500">{s.positive} · {s.neutral} · {s.negative} <span className="text-ink-400">({s.count})</span></span></div>
          <MoodBar positive={s.positive} neutral={s.neutral} negative={s.negative} label={s.label} />
        </li>
      ))}
    </ul>
  );
}

export default function Sentiment() {
  const nav = useNavigate();
  const [caseErr, setCaseErr] = useState<unknown>(null);
  const openCase = async (v: Voice) => {
    setCaseErr(null);
    try {
      const c = await api.openCase({ request_id: v.request_id || null, message_id: null, text: v.text, source: v.kind === "feedback" ? "feedback" : v.request_id ? "request" : "message" });
      nav(`/staff/clock?open=${c.id}`);
    } catch (x) { setCaseErr(x); }
  };
  const [f, setF] = useOwnerFilters();
  const { data: r, loading, error } = useAsync(() => api.owner(f), [f.range, f.destination, f.salesperson]);
  const s = r?.sentiment;
  return (
    <>
      <PageHeader eyebrow="Owner" title="Customer sentiment" description="How customers feel, read by AI from everything they write: trip requests, questions, change requests and after-trip reviews. Works in English, Tagalog and Taglish." />
      <OwnerFilterBar f={f} onChange={setF} report={r} />
      <ErrorBox error={error} />
      {loading && !r ? <Spinner /> : r && s && (
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-3xl bg-ink-950 p-6 text-ivory-50 sm:p-8">
            <div className="glow-orb pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-gold-500/20 blur-3xl" />
            <p className="relative eyebrow text-gold-300">AI reading</p>
            <p className="relative mt-2 font-display text-2xl font-semibold leading-snug sm:text-3xl">{r.briefing.verdict}</p>
            {r.sample_count > 0 && <p className="relative mt-3 text-xs text-ivory-200/60">Includes sample customers and messages for this preview.</p>}
          </div>
          <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Messages read" value={s.total} hint={`from ${r.requests} requests`} />
            <Stat label="Happy" value={`${s.positive_pct}%`} hint={`${s.positive} messages`} />
            <Stat label="Unhappy" value={`${s.negative_pct}%`} tone={s.negative_pct >= 20 ? "red" : undefined} hint={`${s.negative} messages`} />
            <Stat label="After-trip rating" value={s.ratings.avg ? `${s.ratings.avg} / 5` : "—"} tone="gold" hint={`${s.ratings.count} review${s.ratings.count === 1 ? "" : "s"}`} />
          </div>
          {!s.total ? <Empty title="No customer messages for these filters" /> : (
            <>
              <Card title="Mood over time" subtitle={f.range === "30" ? "Per week" : "Per month"} action={<MoodLegend />}>
                <TrendColumns items={s.trend} />
              </Card>
              <div className="grid gap-6 lg:grid-cols-3">
                <Card title="By destination" action={<MoodLegend />}><Slices items={s.by_destination} /></Card>
                <Card title="By salesperson"><Slices items={s.by_salesperson} /></Card>
                <Card title="By stage"><Slices items={s.by_stage} /></Card>
              </div>
              <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
                <Card title="What customers talk about" subtitle="Topics found by the AI, most complaints first">
                  <ul className="space-y-5">
                    {s.themes.map((t) => (
                      <li key={t.theme}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-display text-lg font-semibold text-ink-900">{t.label}</span>
                          <span className="text-xs text-ink-500"><b style={{ color: MOOD_COLOR.positive }}>{t.positive} happy</b> · <b style={{ color: MOOD_COLOR.negative }}>{t.negative} unhappy</b> · {t.count} mentions</span>
                        </div>
                        <MoodBar positive={t.positive} neutral={t.count - t.positive - t.negative} negative={t.negative} label={t.label} />
                        {t.examples[0] && <p className="mt-2 text-sm italic text-ink-500">“{t.examples[0].text}”</p>}
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card title="Needs attention" subtitle="Unhappy messages, newest first. Open one to see the request.">
                  <ErrorBox error={caseErr} />
                  {s.attention.length ? <ul className="space-y-3">{s.attention.map((v, i) => <Quote key={i} v={v} onCase={openCase} />)}</ul> : <Empty title="No unhappy messages">Nice work.</Empty>}
                </Card>
              </div>
              <Card title="After-trip ratings">
                <ul className="space-y-2">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <li key={n} className="flex items-center gap-3 text-sm">
                      <span className="flex w-20 shrink-0 items-center gap-0.5 text-gold-600">{Array.from({ length: n }, (_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ivory-200"><div className="bar-grow h-full rounded-full bg-gold-500" style={{ width: `${s.ratings.count ? (s.ratings.stars[n - 1] / s.ratings.count) * 100 : 0}%` }} /></div>
                      <span className="w-8 text-right tabular-nums text-ink-500">{s.ratings.stars[n - 1]}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </div>
      )}
    </>
  );
}
