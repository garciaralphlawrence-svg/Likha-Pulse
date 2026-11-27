import { AlertTriangle, Printer } from "lucide-react";
import { MONTHS, Recommendation, TripInput, destByCode, fmtDay, paxText, peso } from "../quote/engine";
import type { QuotationTerms } from "../quote/workflow";
import { Logo } from "./Layout";
import { fmtDate } from "../lib/format";

export interface QuotationData {
  customer: string; input: TripInput; rec: Recommendation; option: string | null; lines: { label: string; detail: string; price: number }[];
  discount: number; total: number; per_person: number; notes: string; terms: QuotationTerms;
}

/** The official quotation. Prints cleanly on A4 (only this block is printed). */
export default function Quotation({ q, showPrint = true }: { q: QuotationData; showPrint?: boolean }) {
  const d = destByCode(q.input.destination);
  const opt = q.rec.options.find((o) => o.code === q.option);
  const pax = q.input.adults + q.input.kids;
  const when = q.input.travel_date ? `Departing ${fmtDay(q.input.travel_date)}` : q.input.month ? `${MONTHS[q.input.month - 1]} (date to be confirmed)` : "Dates to be confirmed";
  const t = q.terms;
  return (
    <div>
      {showPrint && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
          {t.expired ? <p className="flex items-center gap-2 text-sm font-medium text-red-800"><AlertTriangle className="h-4 w-4" />This offer expired on {fmtDate(t.valid_until, false)}. Rates must be rechecked.</p> : <p className="text-sm text-ink-500">Valid until {fmtDate(t.valid_until, false)}</p>}
          <button className="btn-secondary" onClick={() => window.print()}><Printer className="h-4 w-4" />Print or save as PDF</button>
        </div>
      )}
      <article className="print-area relative overflow-hidden rounded-2xl border border-ivory-200 bg-white p-5 text-ink-900 shadow-card sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {t.expired && <div className="pointer-events-none absolute right-6 top-24 rotate-[-8deg] rounded-lg border-2 border-red-700 px-3 py-1 text-sm font-bold uppercase tracking-[0.2em] text-red-700 opacity-80">Expired</div>}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink-900 pb-5">
          <Logo />
          <div className="text-right text-sm">
            <p className="font-display text-3xl font-semibold leading-none">Quotation</p>
            <p className="mt-2 font-semibold tracking-wide">{t.ref}</p>
            <p className="text-ink-500">Issued {fmtDate(t.issued, false)}</p>
            <p className="text-ink-500">Valid until {fmtDate(t.valid_until, false)}</p>
          </div>
        </header>

        <section className="grid gap-4 py-5 text-sm sm:grid-cols-2">
          <div><p className="label">Prepared for</p><p className="font-medium">{q.customer}</p></div>
          <div><p className="label">Trip</p><p className="font-medium">{d?.name ?? q.input.place_text ?? "Trip"}, {q.input.days} days / {q.input.days - 1} nights</p><p className="text-ink-500">{when} · {paxText(q.input.adults, q.input.kids)}</p></div>
          {opt && <div className="sm:col-span-2"><p className="label">Package</p><p className="font-medium">{opt.label}: {opt.tier_label} hotel in {opt.hotel.area}</p></div>}
        </section>

        <table className="w-full text-sm">
          <thead><tr className="border-y border-ivory-300 text-left text-[11px] uppercase tracking-[0.12em] text-ink-400"><th className="py-2 pr-3 font-medium">What's included</th><th className="py-2 text-right font-medium">Amount</th></tr></thead>
          <tbody>
            {q.lines.map((l, i) => (
              <tr key={i} className="border-b border-ivory-200 align-top">
                <td className="py-2.5 pr-3"><span className="font-medium">{l.label}</span><span className="block text-xs text-ink-500">{l.detail}</span></td>
                <td className="whitespace-nowrap py-2.5 text-right tabular-nums">{peso(l.price)}</td>
              </tr>
            ))}
            {q.discount > 0 && <tr className="border-b border-ivory-200"><td className="py-2.5 pr-3 font-medium">Discount</td><td className="py-2.5 text-right tabular-nums text-emerald-700">-{peso(q.discount)}</td></tr>}
          </tbody>
          <tfoot>
            <tr><td className="pt-4 text-right font-medium">Total</td><td className="whitespace-nowrap pt-4 text-right font-display text-2xl font-semibold">{peso(q.total)}</td></tr>
            {pax > 1 && <tr><td className="text-right text-xs text-ink-500">Per person</td><td className="text-right text-xs text-ink-500">{peso(q.per_person)}</td></tr>}
          </tfoot>
        </table>
        {q.notes && <p className="mt-4 rounded-xl bg-ivory-100 p-3 text-sm text-ink-700">{q.notes}</p>}

        <section className="mt-6 grid gap-3 rounded-2xl border border-gold-300/60 bg-gold-50 p-4 text-sm sm:grid-cols-2">
          <div><p className="label">To confirm</p><p className="text-lg font-semibold">{peso(t.deposit)} deposit</p></div>
          <div><p className="label">Balance</p><p className="text-lg font-semibold">{peso(t.balance)}</p><p className="text-xs text-ink-500">due {t.balance_due}</p></div>
        </section>

        <section className="mt-6 grid gap-6 text-sm sm:grid-cols-2">
          <div><p className="label">Not included</p><ul className="list-disc space-y-1 pl-5 text-ink-700">{t.exclusions.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div><p className="label">Payment and cancellation</p><ul className="list-disc space-y-1 pl-5 text-ink-700">{t.cancellation.map((x) => <li key={x}>{x}</li>)}</ul></div>
        </section>
        {t.checklist.length > 0 && (
          <section className="mt-6 text-sm">
            <p className="label">Documents to prepare</p>
            <ul className="grid list-disc gap-x-8 gap-y-1 pl-5 text-ink-700 sm:grid-cols-2">{t.checklist.map((x) => <li key={x}>{x}</li>)}</ul>
            <p className="mt-2 text-xs text-ink-500">{t.visa_note}</p>
          </section>
        )}
        <footer className="mt-8 border-t border-ivory-300 pt-4 text-[11px] text-ink-400">
          Prices are based on sample rates for this demonstration and are subject to availability until booked. PAPH Travel and Tours · Quotation {t.ref}
        </footer>
      </article>
    </div>
  );
}
