import { api } from "../api";
import { OwnerFilterBar, ValueBars, useOwnerFilters } from "../components/charts";
import { Card, Empty, ErrorBox, PageHeader, Spinner, Stat } from "../components/ui";
import { peso } from "../lib/format";
import { useAsync } from "../lib/useAsync";

export default function Revenue() {
  const [f, setF] = useOwnerFilters();
  const { data: r, loading, error } = useAsync(() => api.owner(f), [f.range, f.destination, f.salesperson]);
  const v = r?.revenue;
  const top = v?.funnel[0]?.count || 1;
  return (
    <>
      <PageHeader eyebrow="Owner" title="Revenue and margin" description="Booked trips count in the month they were booked. Margin is the customer price minus PAPH's cost." />
      <OwnerFilterBar f={f} onChange={setF} report={r} />
      <ErrorBox error={error} />
      {loading && !r ? <Spinner /> : v && (
        <div className="space-y-6">
          <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Booked revenue" value={peso(v.booked)} hint={`${v.bookings} trip${v.bookings === 1 ? "" : "s"}${v.avg_booking ? ` · avg ${peso(v.avg_booking)}` : ""}`} />
            <Stat label="Margin" value={peso(v.margin)} tone="gold" hint={v.margin_pct === null ? "—" : `${v.margin_pct}% of revenue`} />
            <Stat label="In the pipeline" value={peso(v.pipeline)} hint={`${v.pipeline_count} offer${v.pipeline_count === 1 ? "" : "s"} not yet booked`} />
            <Stat label="Quote to booking" value={v.quote_to_book_pct === null ? "—" : `${v.quote_to_book_pct}%`} hint="of approved quotes became bookings" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Booked revenue by month">
              {v.by_month.length ? <ValueBars items={v.by_month.map((m) => ({ label: m.label, value: m.revenue, hint: `${m.bookings} trip${m.bookings === 1 ? "" : "s"} · margin ${peso(m.margin)}` }))} format={peso} /> : <Empty title="No bookings in this period" />}
            </Card>
            <Card title="By destination">
              {v.by_destination.length ? <ValueBars items={v.by_destination.map((d) => ({ label: d.label, value: d.revenue, hint: `${d.bookings} trip${d.bookings === 1 ? "" : "s"} · margin ${peso(d.margin)}` }))} format={peso} /> : <Empty title="No bookings in this period" />}
            </Card>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card title="From request to booking" subtitle="How many requests reach each step">
              <ol className="space-y-2.5">
                {v.funnel.map((s, i) => (
                  <li key={s.step} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-sm text-ink-700 sm:w-44">{s.label}</span>
                    <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-ivory-100">
                      <div className="bar-grow h-full rounded-lg bg-gradient-to-r from-ink-800 to-ink-700" style={{ width: `${(s.count / top) * 100}%`, animationDelay: `${i * 0.06}s` }} />
                      <span className="absolute inset-y-0 left-3 flex items-center text-xs font-medium text-ivory-50 mix-blend-difference">{s.count}{i > 0 && v.funnel[i - 1].count ? ` · ${Math.round((s.count / v.funnel[i - 1].count) * 100)}%` : ""}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
            <Card title="Why requests were lost">
              {v.lost_reasons.length ? <ValueBars items={v.lost_reasons.map((x) => ({ label: x.label, value: x.count }))} /> : <p className="text-sm text-ink-400">No lost requests in this period.</p>}
            </Card>
          </div>
          {r.sample_count > 0 && <p className="text-xs text-ink-400">Includes sample bookings priced from sample rates, for this preview.</p>}
        </div>
      )}
    </>
  );
}
