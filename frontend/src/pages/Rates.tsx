import { useState } from "react";
import { Card, PageHeader, Tag } from "../components/ui";
import { MONTHS, RULES, TIERS, Tier, catalog, peso } from "../quote/engine";

/** Read-only view of the sample rate catalog the AI uses. Replace backend/app/quotes/catalog.json with real rates. */
export default function Rates() {
  const [code, setCode] = useState(catalog.destinations[0].code);
  const d = catalog.destinations.find((x) => x.code === code)!;
  const range = (r: number[]) => `${peso(r[0])}–${peso(r[1])}`;
  return (
    <>
      <PageHeader eyebrow="Sample rates" title="What the AI prices with" description="These are sample rates for the preview, not PAPH's real prices. Replace them with your actual supplier rates before using this with customers." />
      <p className="mb-5 rounded-2xl border border-gold-300/60 bg-gold-50 p-4 text-sm text-ink-700">{catalog.notice}</p>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {catalog.destinations.map((x) => <button key={x.code} onClick={() => setCode(x.code)} className={`rounded-full border px-3 py-1.5 text-sm transition ${x.code === code ? "border-ink-900 bg-ink-900 text-ivory-50" : "border-ivory-300 bg-white text-ink-600 hover:border-gold-300"}`}>{x.name}</button>)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={d.name} subtitle={`${d.country} · ${d.domestic ? "Local trip" : d.region}`}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-ink-400">Flights</dt><dd>{range(d.flight)} per adult · {d.flight_note}</dd>
            <dt className="text-ink-400">Transfers</dt><dd>{range(d.transfer)} {d.transfer_per_person ? "per person" : "per vehicle (up to 4)"}</dd>
            <dt className="text-ink-400">Local transport</dt><dd>{range(d.local)} per person per day</dd>
            <dt className="text-ink-400">Visa</dt><dd>{d.visa.label}{d.visa.fee[1] > 0 ? ` · ${range(d.visa.fee)} per person` : ""}</dd>
            <dt className="text-ink-400">Busy months</dt><dd>{d.peak_months.map((m) => MONTHS[m - 1].slice(0, 3)).join(", ")}</dd>
            <dt className="text-ink-400">Quiet months</dt><dd>{d.low_months.map((m) => MONTHS[m - 1].slice(0, 3)).join(", ")}</dd>
          </dl>
          <p className="label mt-5">Hotels (per room per night)</p>
          <ul className="space-y-2">
            {(Object.keys(TIERS) as Tier[]).map((t) => <li key={t} className="flex flex-wrap justify-between gap-2 rounded-xl bg-ivory-50 px-3 py-2 text-sm"><span><b className="font-medium">{TIERS[t].label}</b> · {d.hotels[t].area}</span><span className="tabular-nums">{range(d.hotels[t].rate)}</span></li>)}
          </ul>
        </Card>
        <Card title="Tours and activities" subtitle="Per adult; children about half price.">
          <ul className="divide-y divide-ivory-200">
            {d.tours.map((t) => <li key={t.name} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{t.name}</span><span className="tabular-nums text-ink-600">{range(t.price)}</span></li>)}
          </ul>
        </Card>
        <Card title="Pricing rules" className="lg:col-span-2">
          <div className="flex flex-wrap gap-2 text-sm">
            <Tag>Service fee {RULES.service_fee_pct}% (min {peso(RULES.service_fee_min)})</Tag>
            <Tag>Children: flights −{100 - RULES.kid_flight_factor * 100}%, tours −{100 - RULES.kid_tour_factor * 100}%</Tag>
            <Tag>Group of {RULES.group_size}+: −{RULES.group_discount_pct}% hotel and tours</Tag>
            <Tag>Peak season: +{RULES.peak_surcharge_pct}% flights and hotel</Tag>
            <Tag>Quiet months: −{RULES.offpeak_saving_pct}% flights and hotel</Tag>
            <Tag>Rooms: 2 adults per room, kids share</Tag>
            <Tag>Peak in the Philippines: {Object.entries(RULES.ph_peak).map(([m, l]) => `${MONTHS[Number(m) - 1].slice(0, 3)} (${l})`).join(", ")}</Tag>
          </div>
        </Card>
      </div>
    </>
  );
}
