import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Card, Empty, ErrorBox, PageHeader, Spinner, Stat } from "../components/ui";
import { peso } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { RequestRow } from "./Requests";
import { useAuth } from "../lib/auth";
import { ClockStrip } from "../components/clock";

/** Owner only: the AI's one-line verdict and the few things that matter, over the last 90 days. */
function OwnerBriefing() {
  const { data: r } = useAsync(() => api.owner({ range: "90", destination: "", salesperson: "" }), []);
  if (!r) return <div className="mb-6 h-48 animate-pulse rounded-3xl bg-ink-950/90" />;
  return (
    <section className="relative mb-6 overflow-hidden rounded-3xl bg-ink-950 p-6 text-ivory-50 sm:p-8" style={{ animation: "fadeUp .7s cubic-bezier(.2,.7,.2,1) both" }}>
      <div className="glow-orb pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-gold-500/20 blur-3xl" />
      <p className="relative flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-gold-300"><Sparkles className="h-3.5 w-3.5" />Owner briefing · last 90 days</p>
      <p className="relative mt-3 max-w-3xl font-display text-2xl font-semibold leading-snug sm:text-[2rem]">{r.briefing.verdict}</p>
      <ul className="relative mt-5 grid gap-2.5 text-[15px] text-ivory-200/85 md:grid-cols-2">
        {r.briefing.bullets.map((b) => <li key={b} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-300" />{b}</li>)}
      </ul>
      <div className="relative mt-6 flex flex-wrap gap-2 text-sm">
        <Link className="rounded-full border border-gold-300/40 px-3.5 py-1.5 text-gold-300 hover:bg-gold-500/10" to="/staff/sentiment">Customer sentiment</Link>
        <Link className="rounded-full border border-gold-300/40 px-3.5 py-1.5 text-gold-300 hover:bg-gold-500/10" to="/staff/performance">Team performance</Link>
        <Link className="rounded-full border border-gold-300/40 px-3.5 py-1.5 text-gold-300 hover:bg-gold-500/10" to="/staff/revenue">Revenue and margin</Link>
      </div>
      {r.sample_count > 0 && <p className="relative mt-4 text-xs text-ivory-200/50">Based on sample data for this preview.</p>}
    </section>
  );
}

function Bars({ items, max }: { items: { label: string; count: number }[]; max: number }) {
  return (
    <ul className="space-y-2.5">
      {items.map((x, i) => (
        <li key={x.label}>
          <div className="flex justify-between gap-3 text-sm"><span className="text-ink-700">{x.label}</span><span className="tabular-nums text-ink-500">{x.count}</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-ivory-200"><div className="bar-grow h-full rounded-full bg-gradient-to-r from-gold-700 to-gold-300" style={{ width: `${max ? (x.count / max) * 100 : 0}%`, animationDelay: `${i * 0.06}s` }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** Response Clock at a glance: open customer cases and quotation requests waiting for a reply. */
function ClockStrips() {
  const { data: c } = useAsync(() => api.cases("open"), []);
  const { data: d } = useAsync(() => api.dashboard(), []);
  if (!c || !d) return null;
  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      <ClockStrip title="Response Clock: customer cases" counts={c.stats.by_stage} to="/staff/clock" note={c.stats.on_time_pct === null ? undefined : `${c.stats.on_time_pct}% solved on time in the last 90 days`} />
      <ClockStrip title="Quotation requests waiting for a reply" counts={d.request_clock} to="/staff/requests" />
    </div>
  );
}

export default function Dashboard() {
  const { can } = useAuth();
  const { data: d, loading, error } = useAsync(() => api.dashboard(), []);
  if (loading) return <Spinner />;
  if (error || !d) return <ErrorBox error={error} />;
  const statuses = d.by_status.filter((s) => s.count > 0).map((s) => ({ label: s.label, count: s.count }));
  const briefing = [
    d.awaiting_decision.length ? `${d.awaiting_decision.length} offer${d.awaiting_decision.length > 1 ? "s are" : " is"} waiting for your decision` : "No offers are waiting for approval",
    d.waiting_long ? `${d.waiting_long} request${d.waiting_long > 1 ? "s are" : " is"} overdue for a first reply` : "every quotation request has a reply on time",
  ].join(", and ") + ".";
  return (
    <>
      {can("owner.view") && <OwnerBriefing />}
      <PageHeader eyebrow="Overview" title={can("owner.view") ? "Today" : "Your briefing"} description={<>{briefing}{d.sample_count > 0 && <span className="text-gold-700"> Showing {d.sample_count} sample requests.</span>}</>} />
      <ClockStrips />
      <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Open requests" value={d.open} hint={`${d.total} in total`} />
        <Stat label="Overdue replies" value={d.waiting_long} tone={d.waiting_long ? "red" : undefined} hint="Requests past the reply target" />
        <Stat label="Booked" value={d.conversion_pct === null ? "—" : `${d.conversion_pct}%`} hint={`${d.booked} of the offers sent became bookings`} tone="gold" />
        <Stat label="Average quote" value={d.avg_quote ? peso(d.avg_quote) : "—"} hint={`${peso(d.pipeline_value)} in offers not yet booked`} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card title="Waiting for your decision" action={<Link to="/staff/approvals" className="inline-flex items-center gap-1 text-sm text-gold-700 hover:underline">All approvals<ArrowRight className="h-4 w-4" /></Link>}>
          {d.awaiting_decision.length ? <ul className="space-y-3">{d.awaiting_decision.slice(0, 4).map((r) => <RequestRow key={r.id} r={r} />)}</ul> : <Empty title="Nothing to approve">Offers from sales will show up here.</Empty>}
        </Card>
        <div className="space-y-6">
          <Card title="Requests by stage"><Bars items={statuses} max={Math.max(...statuses.map((s) => s.count), 1)} /></Card>
          <Card title="Top destinations"><Bars items={d.top_destinations.map((x) => ({ label: x.name, count: x.count }))} max={d.top_destinations[0]?.count ?? 1} /></Card>
          <Card title="Why we lost requests">{d.lost_reasons.length ? <Bars items={d.lost_reasons.map((x) => ({ label: x.label, count: x.count }))} max={d.lost_reasons[0].count} /> : <p className="text-sm text-ink-400">No lost requests yet.</p>}</Card>
        </div>
      </div>
    </>
  );
}
