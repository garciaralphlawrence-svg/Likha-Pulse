import { Brain, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import FilterBar, { useFilters } from "../components/FilterBar";
import { Card, Empty, ErrorBox, PageHeader, SampleTag, Spinner } from "../components/ui";
import { useAuth } from "../lib/auth";
import { PRIO_COLORS, SENT_COLORS, fmtDate, pretty, signed } from "../lib/format";
import { useAsync } from "../lib/useAsync";

const tick = { fontSize: 11, fill: "#64748b" };

function Kpi({ label, value, sub, tone, to }: { label: string; value: string | number; sub?: string; tone?: string; to?: string }) {
  const body = (
    <div className="card h-full p-4 transition hover:border-slate-300">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: tone ?? "#0f1f3d" }}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

function HBar({ data, dataKey = "count", color, nameKey = "topic", height = 220 }: { data: any[]; dataKey?: string; color: string; nameKey?: string; height?: number }) {
  if (!data.length) return <Empty title="No data for this period" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" tick={tick} allowDecimals={false} />
        <YAxis type="category" dataKey={nameKey} tick={tick} width={150} tickFormatter={(v) => pretty(v)} />
        <Tooltip formatter={(v) => [v, "Mentions"]} labelFormatter={(l) => pretty(String(l))} />
        <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} barSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Dashboard() {
  const { f, set, setF } = useFilters();
  const [gran, setGran] = useState<string>("");
  const { can } = useAuth();
  const nav = useNavigate();
  const { data, error, loading, reload } = useAsync(() => api.dashboard(f, gran || undefined), [JSON.stringify(f), gran]);
  const [gen, setGen] = useState(false);
  const generate = async () => { setGen(true); try { await api.generateInsight(f); await reload(); } finally { setGen(false); } };
  const k = data?.kpis;
  const ins = data?.latest_insight;

  return (
    <>
      <PageHeader title="Dashboard" description="Overview of all collected and analyzed feedback. Every number below is computed from the stored data for the selected filters." />
      <FilterBar f={f} set={set} setF={setF} fields={["platform", "sentiment"]} />
      <ErrorBox error={error} />
      {loading && !data ? <Spinner /> : data && k && (
        <div className="space-y-5">
          {k.sample_count > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <SampleTag /> {k.sample_count === k.total ? "All" : `${k.sample_count} of ${k.total}`} items in this view are sample data for demonstration, not real customer feedback. Connect a platform under Platform Integrations to collect real feedback.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Total feedback collected" value={k.total.toLocaleString()} to="/feedback" />
            <Kpi label="Positive feedback" value={k.positive} sub={`${k.positive_pct}% of total`} tone={SENT_COLORS.positive} />
            <Kpi label="Negative feedback" value={k.negative} sub={`${k.negative_pct}% of total`} tone={SENT_COLORS.negative} />
            <Kpi label="Neutral feedback" value={k.neutral} sub={`${k.neutral_pct}% of total`} tone="#475569" />
            <Kpi label="Pending review" value={k.pending_review} sub="Low confidence or possible sarcasm" to="/feedback" />
            <Kpi label="High-priority concerns" value={k.high_priority} sub={`${k.critical} critical · ${k.unresolved_high_priority} unresolved`} tone={k.high_priority ? PRIO_COLORS.high : undefined} to="/priority" />
            <Kpi label="Average sentiment score" value={signed(k.average_score)} sub="Scale −100 to +100" tone={k.average_score >= 0 ? SENT_COLORS.positive : SENT_COLORS.negative} />
            <Kpi label="Overall sentiment" value={`${k.overall_sentiment_pct}%`} sub="Positive share of opinionated feedback" />
          </div>

          <Card title={<span className="flex items-center gap-2"><Brain className="h-4 w-4 text-navy-700" />AI executive summary</span>}
            subtitle={ins ? `Generated ${fmtDate(ins.created_at)} for ${fmtDate(ins.period.from, false)} – ${fmtDate(ins.period.to, false)} · engine: ${ins.engine === "claude" ? "Claude" : "rule-based"}` : "Not generated yet"}
            action={can("insights.generate") && <button className="btn-secondary" onClick={generate} disabled={gen}><RefreshCw className={`h-4 w-4 ${gen ? "animate-spin" : ""}`} />{gen ? "Analyzing…" : "Generate for current filters"}</button>}>
            {ins ? (
              <div className="grid gap-4 text-sm leading-relaxed text-slate-700 md:grid-cols-2">
                <p className="md:col-span-2">{ins.summary.overall}</p>
                <div><h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">What people appreciate</h3><p>{ins.summary.positives}</p></div>
                <div><h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">Most common complaints</h3><p>{ins.summary.complaints}</p></div>
                <div><h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">Emerging & recurring</h3><p>{ins.summary.emerging} {ins.summary.recurring}</p></div>
                <div><h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">Change over time</h3><p>{ins.summary.trend}</p></div>
                <div className="rounded-lg bg-navy-50 p-3 md:col-span-2"><h3 className="mb-1 text-xs font-semibold uppercase text-navy-700">Suggested management actions</h3><p>{ins.summary.actions}</p></div>
              </div>
            ) : <Empty title="No executive summary yet">Click “Generate” to summarize the selected period from the stored data.</Empty>}
          </Card>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card title="Sentiment distribution">
              {k.total ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={data.distribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}
                      onClick={(d) => setF({ ...f, sentiment: d.name })} cursor="pointer">
                      {data.distribution.map((d) => <Cell key={d.name} fill={SENT_COLORS[d.name]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, pretty(String(n))]} /><Legend formatter={(v) => pretty(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <Empty title="No feedback in this period" />}
            </Card>
            <Card title="Sentiment trend" className="lg:col-span-2"
              action={<div className="flex max-w-full overflow-x-auto rounded-md border border-slate-300 text-xs">{[["", "Auto"], ["day", "Daily"], ["week", "Weekly"], ["month", "Monthly"], ["year", "Yearly"]].map(([v, l]) => (
                <button key={v} onClick={() => setGran(v)} className={`px-2 py-1 ${gran === v ? "bg-navy-900 text-white" : "bg-white hover:bg-slate-50"}`}>{l}</button>))}</div>}>
              {data.trend.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={data.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" />
                    <XAxis dataKey="period" tick={tick} minTickGap={24} /><YAxis tick={tick} allowDecimals={false} />
                    <Tooltip labelFormatter={(l) => `Period: ${l}`} /><Legend formatter={(v) => pretty(v)} />
                    {(["positive", "neutral", "negative"] as const).map((s) => <Area key={s} type="monotone" dataKey={s} stackId="1" stroke={SENT_COLORS[s]} fill={SENT_COLORS[s]} fillOpacity={0.25} />)}
                  </AreaChart>
                </ResponsiveContainer>
              ) : <Empty title="No trend data" />}
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Positive vs. negative feedback" subtitle={`Per ${data.granularity}`}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" /><XAxis dataKey="period" tick={tick} minTickGap={24} /><YAxis tick={tick} allowDecimals={false} />
                  <Tooltip /><Legend formatter={(v) => pretty(v)} />
                  <Bar dataKey="positive" fill={SENT_COLORS.positive} radius={[3, 3, 0, 0]} /><Bar dataKey="negative" fill={SENT_COLORS.negative} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Feedback volume by platform">
              {data.by_platform.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.by_platform}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" /><XAxis dataKey="platform" tick={tick} interval={0} tickFormatter={(v) => String(v).replace("Google Business Profile", "Google").replace("Facebook Page comments", "Facebook").replace("Facebook Messenger", "Messenger").replace("Manual entry", "Manual")} /><YAxis tick={tick} allowDecimals={false} />
                    <Tooltip /><Legend formatter={(v) => pretty(v)} />
                    {(["positive", "neutral", "negative"] as const).map((s) => <Bar key={s} dataKey={s} stackId="p" fill={SENT_COLORS[s]} />)}
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty title="No data" />}
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card title="Top mentioned topics"><HBar data={data.top_topics} color="#203a6b" /></Card>
            <Card title="Most common complaints" subtitle="Topics in negative feedback"><HBar data={data.top_complaints} color={SENT_COLORS.negative} /></Card>
            <Card title="Most appreciated services" subtitle="Topics in positive feedback"><HBar data={data.most_appreciated} color={SENT_COLORS.positive} /></Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Emotion distribution"><HBar data={data.emotions} nameKey="emotion" color="#6d5bd0" height={260} /></Card>
            <Card title="Priority level distribution" subtitle="Click a bar to open those items">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.priorities}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" /><XAxis dataKey="level" tick={tick} tickFormatter={(v) => pretty(v)} /><YAxis tick={tick} allowDecimals={false} />
                  <Tooltip labelFormatter={(l) => pretty(String(l))} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d: any) => nav(`/feedback?priority=${d.level}`)}>
                    {data.priorities.map((p) => <Cell key={p.level} fill={PRIO_COLORS[p.level]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
