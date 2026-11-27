import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Card, Empty, ErrorBox, PageHeader, Spinner, Stat } from "../components/ui";
import { peso } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { RequestRow } from "./Requests";

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

export default function Dashboard() {
  const { data: d, loading, error } = useAsync(() => api.dashboard(), []);
  if (loading) return <Spinner />;
  if (error || !d) return <ErrorBox error={error} />;
  const statuses = d.by_status.filter((s) => s.count > 0).map((s) => ({ label: s.label, count: s.count }));
  const briefing = [
    d.awaiting_decision.length ? `${d.awaiting_decision.length} offer${d.awaiting_decision.length > 1 ? "s are" : " is"} waiting for your decision` : "No offers are waiting for approval",
    d.waiting_long ? `${d.waiting_long} request${d.waiting_long > 1 ? "s have" : " has"} waited over 24 hours` : "every customer has been answered within a day",
  ].join(", and ") + ".";
  return (
    <>
      <PageHeader eyebrow="Overview" title="Your briefing" description={<>{briefing}{d.sample_count > 0 && <span className="text-gold-700"> Showing {d.sample_count} sample requests.</span>}</>} />
      <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Open requests" value={d.open} hint={`${d.total} in total`} />
        <Stat label="Waiting 24h+" value={d.waiting_long} tone={d.waiting_long ? "red" : undefined} hint="Need a reply first" />
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
