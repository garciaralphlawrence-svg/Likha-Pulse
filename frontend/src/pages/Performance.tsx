import clsx from "clsx";
import { api } from "../api";
import { OwnerFilterBar, useOwnerFilters } from "../components/charts";
import { Card, Empty, ErrorBox, PageHeader, Spinner } from "../components/ui";
import { peso } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import type { TeamRow } from "../quote/owner";

const moodWord = (n: number | null) => (n === null ? "—" : n >= 25 ? "Happy" : n <= -25 ? "Unhappy" : "Neutral");
const COLS: { label: string; hint: string; value: (t: TeamRow) => string; warn?: (t: TeamRow) => boolean }[] = [
  { label: "Requests", hint: "assigned to them", value: (t) => String(t.handled) },
  { label: "First reply", hint: "average time to start", value: (t) => (t.avg_response_hours === null ? "—" : t.avg_response_hours < 1 ? "under 1h" : `${t.avg_response_hours}h`), warn: (t) => (t.avg_response_hours ?? 0) >= 12 },
  { label: "Offers sent", hint: "for approval", value: (t) => String(t.offers_sent) },
  { label: "Approved", hint: "of offers decided", value: (t) => (t.approval_rate === null ? "—" : `${t.approval_rate}%`) },
  { label: "Booked", hint: "of approved offers", value: (t) => (t.booking_rate === null ? "—" : `${t.booking_rate}%`) },
  { label: "Revenue", hint: "booked trips", value: (t) => peso(t.revenue) },
  { label: "Avg margin", hint: "on approved offers", value: (t) => (t.avg_margin_pct === null ? "—" : `${t.avg_margin_pct}%`), warn: (t) => t.avg_margin_pct !== null && t.avg_margin_pct < 8 },
  { label: "Cases on time", hint: "Response Clock, solved in time", value: (t) => (t.cases_on_time_pct === null ? "—" : `${t.cases_on_time_pct}% of ${t.cases_solved}`), warn: (t) => t.cases_on_time_pct !== null && t.cases_on_time_pct < 70 },
  { label: "Customer mood", hint: "from their customers", value: (t) => `${moodWord(t.sentiment_score)}${t.sentiment_score === null ? "" : ` (${t.sentiment_score > 0 ? "+" : ""}${t.sentiment_score})`}` },
];

export default function Performance() {
  const [f, setF] = useOwnerFilters();
  const { data: r, loading, error } = useAsync(() => api.owner(f), [f.range, f.destination, f.salesperson]);
  const best = r?.team.length ? [...r.team].sort((a, b) => (a.avg_response_hours ?? 99) - (b.avg_response_hours ?? 99))[0] : null;
  return (
    <>
      <PageHeader eyebrow="Owner" title="Sales and team performance" description="Who handles requests, how fast they reply, how many offers get approved and booked, and how their customers feel." />
      <OwnerFilterBar f={f} onChange={setF} report={r} />
      <ErrorBox error={error} />
      {loading && !r ? <Spinner /> : !r?.team.length ? <Empty title="No assigned requests for these filters" /> : (
        <div className="space-y-6">
          {best && r.team.length > 1 && <p className="rounded-2xl border border-gold-300/60 bg-gold-50 px-5 py-4 font-display text-xl text-ink-800">{best.name} replies fastest ({best.avg_response_hours}h on average). {r.team[0].name} brings in the most revenue ({peso(r.team[0].revenue)}).</p>}
          <div className="stagger grid gap-5 md:grid-cols-2">
            {r.team.map((t) => (
              <Card key={t.id} title={t.name}>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
                  {COLS.map((c) => (
                    <div key={c.label} className="min-w-0">
                      <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">{c.label}</dt>
                      <dd className={clsx("mt-0.5 font-display text-xl font-semibold", c.warn?.(t) ? "text-red-800" : "text-ink-900")}>{c.value(t)}</dd>
                      <dd className="text-[11px] text-ink-400">{c.hint}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ))}
          </div>
          <p className="text-xs text-ink-400">Red means worth a look: first reply over 12 hours, margin under 8%, or fewer than 70% of cases solved on time.{r.sample_count > 0 ? " Includes sample data for this preview." : ""}</p>
        </div>
      )}
    </>
  );
}
