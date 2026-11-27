// Team response report: who handled each message and how fast, per staff member and per month. Exportable as CSV.
import clsx from "clsx";
import { Download, Sparkles } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import type { TeamReport as TR } from "../api/types";
import FeedbackDrawer from "../components/FeedbackDrawer";
import { Card, Empty, ErrorBox, PageHeader, PriorityBadge, Spinner, Tag } from "../components/ui";
import { PLATFORM_LABEL, fmtDate } from "../lib/format";
import { mins } from "../lib/teamtools";
import { useAsync } from "../lib/useAsync";

const tick = { fontSize: 11, fill: "#8a8f99" };
const COLORS = ["#b8975a", "#14161b", "#2f7d62", "#c0672c", "#8a8f99", "#a5844a", "#5b606b"];
const monthName = (k: string) => new Date(`${k}-01T00:00:00`).toLocaleDateString("en-PH", { month: "short", year: "2-digit" });

function verdict(d: TR): string {
  const named = d.staff.filter((s) => s.name !== "Not assigned" && s.avg_first_reply_minutes !== null);
  if (!d.totals.handled) return "No handled messages in this period yet.";
  const fastest = [...named].sort((a, b) => a.avg_first_reply_minutes! - b.avg_first_reply_minutes!)[0];
  const most = [...named].sort((a, b) => b.handled - a.handled)[0];
  if (!fastest) return `Your team handled ${d.totals.handled} messages. Assign cases so you can see who did what.`;
  return fastest.name === most.name
    ? `${fastest.name} handled the most messages and replied the fastest (${mins(fastest.avg_first_reply_minutes)} on average).`
    : `${most.name} handled the most messages (${most.handled}); ${fastest.name} replied the fastest (${mins(fastest.avg_first_reply_minutes)} on average).`;
}

export default function TeamReport() {
  const [months, setMonths] = useState(6);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const { data, error, loading } = useAsync(() => api.teamReport(months), [months]);
  const exportCsv = async () => { setBusy(true); setErr(null); try { await api.downloadTeamReport(months); } catch (e) { setErr(e); } finally { setBusy(false); } };
  const monthly = data ? data.months.map((m) => ({ month: monthName(m), ...Object.fromEntries(data.by_month.filter((r) => r.month === m).map((r) => [r.name, r.handled])) })) : [];
  const speed = data ? data.staff.filter((s) => s.avg_first_reply_minutes !== null).map((s) => ({ name: s.name, reply: s.avg_first_reply_minutes, solve: s.avg_resolution_minutes })) : [];

  return (
    <>
      <PageHeader eyebrow="Team report" title="Who handled what, and how fast"
        description="First reply time is how long a traveler waited for the first answer. Time to solve is how long until the message or case was marked done."
        actions={<>
          <div className="flex rounded-full border border-ivory-300 bg-white p-1">
            {[3, 6, 12].map((m) => <button key={m} onClick={() => setMonths(m)} className={clsx("whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition", months === m ? "bg-ink-900 text-ivory-50" : "text-ink-500 hover:text-ink-900")}>{m} months</button>)}
          </div>
          <button className="btn-secondary" disabled={busy || !data} onClick={exportCsv}><Download className="h-4 w-4" />Export CSV</button>
        </>} />
      <ErrorBox error={error || err} />
      {loading && !data ? <Spinner /> : data && (
        <div className="space-y-6">
          <section className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 text-ivory-100 shadow-lift">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-500/15 blur-3xl" />
            <p className="relative flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-gold-300"><Sparkles className="h-3.5 w-3.5" />In one line</p>
            <p className="relative mt-2 font-display text-[28px] leading-tight text-ivory-50">{verdict(data)}</p>
            <div className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[["Handled", data.totals.handled], ["Replied", data.totals.replied], ["Avg. first reply", mins(data.totals.avg_first_reply_minutes)], ["Avg. time to solve", mins(data.totals.avg_resolution_minutes)]].map(([k, v]) => (
                <div key={String(k)} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-gold-300/80">{k}</p><p className="mt-1 font-display text-2xl text-ivory-50">{v}</p></div>
              ))}
            </div>
          </section>

          {!data.staff.length ? <Empty title="Nothing handled yet">When your team replies to messages or works on Response Clock cases, it shows here.</Empty> : (<>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Messages handled per month">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthly} margin={{ left: -12 }}>
                    <CartesianGrid vertical={false} stroke="#efe8dc" />
                    <XAxis dataKey="month" tick={tick} axisLine={false} tickLine={false} /><YAxis tick={tick} allowDecimals={false} axisLine={false} tickLine={false} width={36} />
                    <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
                    {data.team.map((n, i) => <Bar key={n} dataKey={n} stackId="t" fill={COLORS[i % COLORS.length]} barSize={22} />)}
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card title="How fast each person replies" subtitle="Average minutes until the first reply (shorter is better)">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={speed} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" tick={tick} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" tick={tick} width={100} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => [mins(v), "First reply"]} />
                    <Bar dataKey="reply" fill="#b8975a" barSize={16} radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <Card title="Per staff member">
              <div className="-mx-6 overflow-x-auto px-6">
                <table className="w-full min-w-[560px] text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-[0.14em] text-ink-400"><th className="py-2 font-medium">Staff member</th><th className="font-medium">Handled</th><th className="font-medium">Replied</th><th className="font-medium">Solved</th><th className="font-medium">First reply</th><th className="font-medium">Time to solve</th></tr></thead>
                  <tbody className="divide-y divide-ivory-200">
                    {data.staff.map((s) => <tr key={s.name}><td className="py-2.5 font-medium text-ink-900">{s.name}</td><td>{s.handled}</td><td>{s.replied}</td><td>{s.solved}</td><td>{mins(s.avg_first_reply_minutes)}</td><td>{mins(s.avg_resolution_minutes)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Per month" subtitle="Average first reply time, per person">
              <div className="-mx-6 overflow-x-auto px-6">
                <table className="w-full min-w-[560px] text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-[0.14em] text-ink-400"><th className="py-2 font-medium">Staff member</th>{data.months.map((m) => <th key={m} className="font-medium">{monthName(m)}</th>)}</tr></thead>
                  <tbody className="divide-y divide-ivory-200">
                    {data.team.map((n) => (
                      <tr key={n}><td className="py-2.5 font-medium text-ink-900">{n}</td>
                        {data.months.map((m) => { const r = data.by_month.find((x) => x.month === m && x.name === n); return <td key={m} className="tabular-nums">{r ? <>{mins(r.avg_first_reply_minutes)}<span className="block text-[11px] text-ink-400">{r.handled} handled</span></> : <span className="text-ink-400">—</span>}</td>; })}
                      </tr>))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Recently handled" subtitle="Tap a message to open it">
              <ul className="divide-y divide-ivory-200">
                {data.items.slice(0, 15).map((r) => (
                  <li key={r.id}>
                    <button onClick={() => setOpen(r.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 py-3 text-left hover:bg-ivory-50">
                      <span className="w-32 shrink-0 text-sm font-medium text-ink-800">{r.handler}</span>
                      <span className="min-w-0 flex-1 basis-60 truncate text-[15px] text-ink-700">“{r.content}”</span>
                      <span className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-ink-400">
                        {r.is_case && <PriorityBadge value={r.priority} />}
                        <span>{PLATFORM_LABEL[r.platform] ?? r.platform_name} · {fmtDate(r.started_at, false)}</span>
                        <Tag tone={r.status === "solved" ? "green" : r.status === "replied" ? "slate" : "gold"}>{r.status === "solved" ? `Solved in ${mins(r.resolution_minutes)}` : r.status === "replied" ? `Replied in ${mins(r.first_reply_minutes)}` : "Waiting"}</Tag>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </>)}
        </div>
      )}
      <FeedbackDrawer id={open} onClose={() => setOpen(null)} />
    </>
  );
}
