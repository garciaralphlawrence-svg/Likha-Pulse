import { Star } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { StagePill } from "../components/clock";
import { MoodBar, MoodLegend } from "../components/charts";
import { Card, Empty, ErrorBox, PageHeader, Spinner, Stat, StatusBadge, Tag } from "../components/ui";
import { fmtDate, peso } from "../lib/format";
import { useAsync } from "../lib/useAsync";

const MOOD = { positive: ["green", "Happy"], neutral: ["slate", "Neutral"], negative: ["red", "Unhappy"] } as const;

/** Everything about one customer: requests, offers, bookings, messages, cases and ratings. */
export default function Clients() {
  const { key = "" } = useParams();
  const { data: c, loading, error } = useAsync(() => api.client(key), [key]);
  if (loading) return <Spinner />;
  if (error || !c) return <ErrorBox error={error} />;
  return (
    <>
      <PageHeader eyebrow="Client history" title={c.name} description={c.contact ?? "From Facebook or Messenger"} />
      <p className="mb-6 rounded-2xl bg-ink-950 px-5 py-4 font-display text-xl text-ivory-50 sm:text-2xl">{c.verdict}</p>
      <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Trips booked" value={c.booked} hint={c.booked ? `${peso(c.spent)} in total` : "None yet"} />
        <Stat label="Requests" value={c.requests.length} />
        <Stat label="Messages" value={c.messages} hint="Facebook and Messenger" />
        <Stat label="Rating" value={c.rating ? `${c.rating} / 5` : "—"} tone="gold" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-6">
          <Card title="Mood" action={<MoodLegend />}><MoodBar {...c.moods} label={c.name} /><p className="mt-2 text-xs text-ink-500">{c.moods.positive} happy · {c.moods.neutral} neutral · {c.moods.negative} unhappy</p></Card>
          <Card title="Quotation requests">
            {c.requests.length ? <ul className="divide-y divide-ivory-200">{c.requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <Link className="min-w-0 font-medium text-ink-900 hover:text-gold-700" to={`/staff/requests/${r.id}`}>{r.ref} · {r.destination}, {r.days} days</Link>
                <span className="flex items-center gap-2"><StatusBadge status={r.status} />{r.price !== null && <span className="tabular-nums text-ink-500">{peso(r.price)}</span>}</span>
              </li>))}</ul> : <Empty title="No quotation requests yet" />}
          </Card>
          <Card title="Cases">
            {c.cases.length ? <ul className="space-y-2">{c.cases.map((x) => (
              <li key={x.id}><Link to={`/staff/clock?open=${x.id}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-ivory-200 bg-white px-3 py-2 text-sm hover:border-gold-300"><StagePill stage={x.stage} small /><span className="font-medium">{x.situation_label}</span><span className="text-xs text-ink-400">{fmtDate(x.opened_at, false)}</span></Link></li>))}</ul> : <p className="text-sm text-ink-400">No cases.</p>}
          </Card>
        </div>
        <Card title="Everything, newest first">
          {c.timeline.length ? <ol className="space-y-3 border-l border-ivory-300 pl-4">
            {c.timeline.map((t, i) => (
              <li key={i} className="text-sm">
                <div className="flex flex-wrap items-center gap-2"><b className="font-medium">{t.kind.startsWith("Rated") ? <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-gold-500 text-gold-500" />{t.kind}</span> : t.kind}</b>{t.mood && <Tag tone={MOOD[t.mood as keyof typeof MOOD][0]}>{MOOD[t.mood as keyof typeof MOOD][1]}</Tag>}{t.ref && t.request_id && <Link className="text-xs text-gold-700 hover:underline" to={`/staff/requests/${t.request_id}`}>{t.ref}</Link>}</div>
                {t.text && <p className="mt-0.5 text-ink-600">{t.text}</p>}
                <p className="text-xs text-ink-400">{fmtDate(t.at)}</p>
              </li>
            ))}
          </ol> : <Empty title="Nothing yet" />}
        </Card>
      </div>
    </>
  );
}
