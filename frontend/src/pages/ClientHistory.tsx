// Client history: every message from the same traveler in one view, how their feelings changed, and any open case.
import { ArrowLeft, Sparkles, Timer, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import FeedbackDrawer from "../components/FeedbackDrawer";
import FeedbackTable from "../components/FeedbackTable";
import { Card, ErrorBox, PriorityBadge, Spinner } from "../components/ui";
import { STAGES, dur, stageOf } from "../lib/clock";
import { MOOD, SENT_COLORS, fmtDate } from "../lib/format";
import { useAsync } from "../lib/useAsync";

const tick = { fontSize: 11, fill: "#8a8f99" };

export default function ClientHistory() {
  const { ref = "" } = useParams();
  const nav = useNavigate();
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAsync(() => api.client(ref), [ref]);
  const PAGE = 10;
  if (loading && !data) return <Spinner />;
  if (error || !data) return <><ErrorBox error={error} /><Link to="/feedback" className="btn-secondary"><ArrowLeft className="h-4 w-4" />Back to Inbox</Link></>;
  const points = data.feelings.map((f) => ({ day: new Date(f.at).toLocaleDateString("en-PH", { month: "short", day: "numeric" }), score: f.score, sentiment: f.sentiment }));
  const now = Date.now();
  return (
    <>
      <button className="btn-ghost -ml-3 mb-3" onClick={() => (history.length > 1 ? nav(-1) : nav("/feedback"))}><ArrowLeft className="h-4 w-4" />Back</button>
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-ink-950 p-7 text-ivory-100 shadow-lift md:p-9">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-gold-500/15 blur-3xl" />
        <p className="relative flex items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-gold-300"><UserRound className="h-3.5 w-3.5" />Client history</p>
        <h1 className="relative mt-1 font-display text-4xl font-semibold text-ivory-50 md:text-5xl">{data.name}</h1>
        <p className="relative mt-3 flex items-start gap-2 font-display text-2xl leading-snug text-ivory-50"><Sparkles className="mt-1.5 h-4 w-4 shrink-0 text-gold-300" />{data.verdict}</p>
        <div className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Messages", String(data.total)],
            ["Happy · Unhappy", `${data.moods.positive} · ${data.moods.negative}`],
            ["First message", fmtDate(data.first_seen, false)],
            ["Latest", fmtDate(data.last_seen, false)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold-300/80">{k}</p>
              <p className="mt-1 font-display text-2xl text-ivory-50">{v}</p>
            </div>
          ))}
        </div>
        <p className="relative mt-4 text-xs text-ivory-200/60">{Object.entries(data.platforms).map(([p, n]) => `${p.replace("Facebook Page comments", "Facebook comments").replace("Facebook Messenger", "Messenger")}: ${n}`).join(" · ")}</p>
      </section>

      {data.open_cases.length > 0 && (
        <Card title="Open cases" subtitle="This traveler is waiting on the Response Clock" className="mb-6">
          <ul className="divide-y divide-ivory-200">
            {data.open_cases.map((c) => { const st = stageOf(c, now); const left = +new Date(c.due_at) - now; return (
              <li key={c.id}><Link to={`/cases?open=${c.id}`} className="flex items-center gap-3 py-3 hover:bg-ivory-50">
                <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: STAGES[st].color }} />
                <PriorityBadge value={c.priority} />
                <span className="min-w-0 flex-1 truncate text-[15px] text-ink-800">“{c.content}”</span>
                <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums" style={{ color: STAGES[st].color }}><Timer className="h-4 w-4" />{left >= 0 ? `${dur(left)} left` : `Overdue ${dur(-left)}`}</span>
              </Link></li>); })}
          </ul>
        </Card>
      )}

      <Card title="Feelings over time" subtitle="Each dot is one message: above the line is happy, below is unhappy" className="mb-6">
        {points.length > 1 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={points} margin={{ left: -8, right: 8 }}>
              <CartesianGrid vertical={false} stroke="#efe8dc" />
              <XAxis dataKey="day" tick={tick} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis domain={[-100, 100]} ticks={[-100, 0, 100]} tick={tick} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => (v > 0 ? "Happy" : v < 0 ? "Unhappy" : "")} />
              <ReferenceLine y={0} stroke="#d9c39a" strokeDasharray="4 4" />
              <Tooltip formatter={(v: number, _n, p) => [MOOD[(p?.payload as { sentiment: string }).sentiment] ?? v, "Mood"]} />
              <Line type="monotone" dataKey="score" stroke="#b8975a" strokeWidth={2}
                dot={(props: { cx?: number; cy?: number; payload?: { sentiment: string }; index?: number }) => <circle key={props.index} cx={props.cx} cy={props.cy} r={4.5} fill={SENT_COLORS[props.payload?.sentiment ?? "neutral"]} stroke="#fff" strokeWidth={1.5} />} />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-ink-400">Only one message so far. The chart appears when this traveler writes again.</p>}
      </Card>

      <h2 className="mb-3 font-display text-2xl font-semibold text-ink-900">Every message</h2>
      <FeedbackTable hideClient data={{ total: data.timeline.length, page, page_size: PAGE, items: data.timeline.slice((page - 1) * PAGE, page * PAGE) }} page={page} pageSize={PAGE} onPage={setPage} onOpen={setOpen} />
      <FeedbackDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />
    </>
  );
}
