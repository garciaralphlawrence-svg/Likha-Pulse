import { ArrowRight, Heart, MessageSquare, Siren, Sparkles, ThumbsDown, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import type { Dashboard as D } from "../api/types";
import FeedbackDrawer from "../components/FeedbackDrawer";
import FilterBar, { useFilters } from "../components/FilterBar";
import { Card, Empty, ErrorBox, PriorityBadge, Spinner } from "../components/ui";
import { useAuth } from "../lib/auth";
import { PLATFORM_LABEL, SENT_COLORS, ago, headline } from "../lib/format";
import { useAsync } from "../lib/useAsync";

const tick = { fontSize: 11, fill: "#8a8f99" };
const lc = (s: string) => s.toLowerCase().replace(" & ", " and ");

function briefing(d: D): { icon: JSX.Element; text: JSX.Element; tone: string }[] {
  const k = d.kpis, out: { icon: JSX.Element; text: JSX.Element; tone: string }[] = [];
  if (!k.total) return [{ icon: <MessageSquare className="h-4 w-4" />, text: <>No new messages in this period.</>, tone: "text-ink-500" }];
  out.push(k.unresolved_high_priority
    ? { icon: <Siren className="h-4 w-4" />, text: <><b>{k.unresolved_high_priority} message{k.unresolved_high_priority > 1 ? "s need" : " needs"} your attention</b>{k.critical ? ` (${k.critical} urgent)` : ""}. Reply to these first.</>, tone: "text-red-800" }
    : { icon: <Siren className="h-4 w-4" />, text: <>Nothing urgent. You're all caught up.</>, tone: "text-emerald-800" });
  const happy = k.positive_pct, unhappy = k.negative_pct;
  out.push({ icon: <Heart className="h-4 w-4" />, tone: "text-ink-800",
    text: happy >= unhappy ? <><b>{happy}% of customers are happy</b>, {unhappy}% are unhappy.</> : <><b>More customers are unhappy ({unhappy}%) than happy ({happy}%)</b> this period.</> });
  if (d.top_complaints[0]) out.push({ icon: <ThumbsDown className="h-4 w-4" />, tone: "text-ink-800", text: <>Most complaints are about <b>{lc(d.top_complaints[0].topic)}</b> ({d.top_complaints[0].count} messages){d.top_complaints[1] ? <>, then {lc(d.top_complaints[1].topic)}</> : null}.</> });
  if (d.most_appreciated[0]) out.push({ icon: <Sparkles className="h-4 w-4" />, tone: "text-ink-800", text: <>Customers love your <b>{lc(d.most_appreciated[0].topic)}</b>. Share the praise with the team.</> });
  if (d.trend.length >= 4) {
    const half = Math.floor(d.trend.length / 2), share = (rows: D["trend"]) => { const t = rows.reduce((a, r) => a + r.positive + r.neutral + r.negative, 0); return t ? rows.reduce((a, r) => a + r.negative, 0) / t : 0; };
    const a = share(d.trend.slice(0, half)), b = share(d.trend.slice(half));
    if (Math.abs(b - a) >= 0.05) out.push(b > a
      ? { icon: <TrendingDown className="h-4 w-4" />, tone: "text-red-800", text: <>Unhappy messages are <b>increasing</b> lately ({Math.round(a * 100)}% → {Math.round(b * 100)}%).</> }
      : { icon: <TrendingUp className="h-4 w-4" />, tone: "text-emerald-800", text: <>Good news: unhappy messages are <b>going down</b> ({Math.round(a * 100)}% → {Math.round(b * 100)}%).</> });
  }
  if (k.pending_review) out.push({ icon: <MessageSquare className="h-4 w-4" />, tone: "text-ink-600", text: <>{k.pending_review} message{k.pending_review > 1 ? "s are" : " is"} unclear (maybe sarcasm). Take a quick look in the Inbox.</> });
  return out;
}

function Stat({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="card p-6">
      <p className="eyebrow !text-ink-400">{label}</p>
      <p className="mt-2 font-display text-5xl font-semibold leading-none" style={{ color: accent ?? "#14161b" }}>{value}</p>
      {sub && <p className="mt-2 text-sm text-ink-400">{sub}</p>}
    </div>
  );
}

function TopicBars({ data, color }: { data: { topic: string; count: number }[]; color: string }) {
  if (!data.length) return <p className="text-sm text-ink-400">Nothing stands out yet.</p>;
  const max = Math.max(...data.map((d) => d.count));
  return (
    <ul className="space-y-3">
      {data.slice(0, 5).map((d) => (
        <li key={d.topic}>
          <div className="mb-1 flex justify-between text-sm"><span className="text-ink-800">{d.topic}</span><span className="tabular-nums text-ink-400">{d.count}</span></div>
          <div className="h-1.5 rounded-full bg-ivory-200"><div className="h-full rounded-full" style={{ width: `${(100 * d.count) / max}%`, background: color }} /></div>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { f, set, setF } = useFilters();
  const { user } = useAuth();
  const [open, setOpen] = useState<string | null>(null);
  const days = f.date_from && f.date_to ? (+new Date(f.date_to) - +new Date(f.date_from)) / 86400000 : 30;
  const { data, error, loading, reload } = useAsync(() => api.dashboard(f, days > 120 ? "month" : days > 10 ? "week" : "day"), [JSON.stringify(f)]);
  const urgent = useAsync(() => api.feedback({ ...f, priority: "critical,high", action: "unresolved" }, 1, 4), [JSON.stringify(f)]);
  const k = data?.kpis;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <div className="mb-7">
        <p className="eyebrow">Overview</p>
        <h1 className="font-display text-5xl font-semibold leading-tight text-ink-900">{greet}, {user?.full_name.split(" ")[0]}.</h1>
        <p className="mt-2 text-[15px] text-ink-500">Here's what your customers are saying across Google, Facebook and Messenger.</p>
      </div>
      <FilterBar f={f} set={set} setF={setF} fields={["platform"]} />
      <ErrorBox error={error} />
      {loading && !data ? <Spinner /> : data && k && (
        <div className="space-y-6">
          <section className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 text-ivory-100 shadow-lift md:p-9">
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-gold-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-gold-300/10 blur-3xl" />
            <div className="relative flex flex-wrap items-end justify-between gap-4">
              <div><p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-gold-300"><Sparkles className="h-3.5 w-3.5" />Your Briefing</p>
                <h2 className="mt-1 font-display text-3xl font-semibold text-ivory-50">What matters right now</h2></div>
              <Link to="/insights" className="inline-flex items-center gap-1.5 text-sm text-gold-300 hover:text-gold-100">Full AI summary <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <ul className="relative mt-6 grid gap-3 md:grid-cols-2">
              {briefing(data).map((b, i) => (
                <li key={i} className="flex gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-[15px] leading-relaxed text-ivory-100">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-500/15 text-gold-300">{b.icon}</span>
                  <span className="[&_b]:font-semibold [&_b]:text-ivory-50">{b.text}</span>
                </li>
              ))}
            </ul>
            {k.sample_count > 0 && <p className="relative mt-5 text-xs text-ivory-200/60">Showing sample messages for preview. Real messages appear once Google or Facebook is connected.</p>}
          </section>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Messages" value={k.total.toLocaleString()} sub="comments, reviews & chats" />
            <Stat label="Happy" value={`${k.positive_pct}%`} sub={`${k.positive} customers`} accent={SENT_COLORS.positive} />
            <Stat label="Unhappy" value={`${k.negative_pct}%`} sub={`${k.negative} customers`} accent={SENT_COLORS.negative} />
            <Stat label="Need attention" value={k.unresolved_high_priority} sub={k.unresolved_high_priority ? "waiting for a reply" : "all caught up"} accent={k.unresolved_high_priority ? "#a5844a" : undefined} />
          </div>

          <Card title="Needs your attention" subtitle="Urgent and important messages not yet done" action={<Link to="/priority" className="inline-flex items-center gap-1 text-sm text-gold-700 hover:underline">See all <ArrowRight className="h-4 w-4" /></Link>}>
            {urgent.loading && !urgent.data ? <Spinner /> : !urgent.data?.items.length ? <p className="text-sm text-ink-400">Nothing urgent right now. 🎉</p> : (
              <ul className="divide-y divide-ivory-200">
                {urgent.data.items.map((m) => (
                  <li key={m.id}>
                    <button onClick={() => setOpen(m.id)} className="flex w-full items-start gap-4 py-3.5 text-left hover:bg-ivory-50">
                      <PriorityBadge value={m.priority} />
                      <div className="min-w-0 flex-1"><p className="text-[15px] text-ink-900">{headline(m)}</p><p className="mt-0.5 truncate text-sm text-ink-400">“{m.content}”</p></div>
                      <span className="hidden shrink-0 text-xs text-ink-400 sm:block">{PLATFORM_LABEL[m.platform]} · {ago(m.created_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Customer mood">
              {k.total ? (
                <div className="relative">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart><Pie data={data.distribution} dataKey="value" nameKey="name" innerRadius={68} outerRadius={92} paddingAngle={3} stroke="none">
                      {data.distribution.map((d) => <Cell key={d.name} fill={SENT_COLORS[d.name]} />)}</Pie>
                      <Tooltip formatter={(v, n) => [v, ({ positive: "Happy", neutral: "Neutral", negative: "Unhappy" } as any)[String(n)]]} /></PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="font-display text-4xl font-semibold">{k.overall_sentiment_pct}%</p><p className="text-[11px] uppercase tracking-[0.16em] text-ink-400">satisfied</p></div></div>
                  <div className="mt-2 flex justify-center gap-4 text-xs text-ink-500">{[["positive", "Happy"], ["neutral", "Neutral"], ["negative", "Unhappy"]].map(([kk, l]) => <span key={kk} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SENT_COLORS[kk] }} />{l}</span>)}</div>
                </div>
              ) : <Empty title="No messages yet" />}
            </Card>
            <Card title="Mood over time" className="lg:col-span-2">
              {data.trend.length ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={data.trend}>
                    <defs>{(["positive", "negative"] as const).map((s) => <linearGradient key={s} id={`g-${s}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={SENT_COLORS[s]} stopOpacity={0.35} /><stop offset="1" stopColor={SENT_COLORS[s]} stopOpacity={0} /></linearGradient>)}</defs>
                    <CartesianGrid vertical={false} stroke="#efe8dc" />
                    <XAxis dataKey="period" tick={tick} minTickGap={28} axisLine={false} tickLine={false} /><YAxis tick={tick} allowDecimals={false} axisLine={false} tickLine={false} width={28} />
                    <Tooltip formatter={(v, n) => [v, n === "positive" ? "Happy" : "Unhappy"]} />
                    <Area type="monotone" dataKey="positive" stroke={SENT_COLORS.positive} strokeWidth={2} fill="url(#g-positive)" />
                    <Area type="monotone" dataKey="negative" stroke={SENT_COLORS.negative} strokeWidth={2} fill="url(#g-negative)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <Empty title="No data yet" />}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="What they complain about"><TopicBars data={data.top_complaints} color={SENT_COLORS.negative} /></Card>
            <Card title="What they love"><TopicBars data={data.most_appreciated} color={SENT_COLORS.positive} /></Card>
            <Card title="Where messages come from">
              {data.by_platform.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.by_platform} layout="vertical" margin={{ left: 4 }}>
                    <XAxis type="number" hide /><YAxis type="category" dataKey="platform" tick={tick} width={110} axisLine={false} tickLine={false}
                      tickFormatter={(v) => String(v).replace("Google Business Profile", "Google").replace("Facebook Page comments", "Facebook").replace("Facebook Messenger", "Messenger").replace("Manual entry", "Staff")} />
                    <Tooltip formatter={(v, n) => [v, ({ positive: "Happy", neutral: "Neutral", negative: "Unhappy" } as any)[String(n)]]} />
                    {(["positive", "neutral", "negative"] as const).map((s, i) => <Bar key={s} dataKey={s} stackId="p" fill={SENT_COLORS[s]} barSize={16} radius={i === 2 ? [0, 8, 8, 0] : 0} />)}
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty title="No data" />}
            </Card>
          </div>
        </div>
      )}
      <FeedbackDrawer id={open} onClose={() => setOpen(null)} onChanged={() => { reload(); urgent.reload(); }} />
    </>
  );
}
