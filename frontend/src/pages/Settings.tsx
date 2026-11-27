import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, ErrorBox, PageHeader, Spinner } from "../components/ui";
import type { Settings as S } from "../quote/workflow";

type NumKey = { [K in keyof S]: S[K] extends number ? K : never }[keyof S];
const PRICING: { key: NumKey; label: string; hint: string; unit: string }[] = [
  { key: "service_fee_pct", label: "PAPH service fee", hint: "Added on top of the costs in every AI estimate and new offer.", unit: "%" },
  { key: "min_margin_pct", label: "Lowest margin without a reason", hint: "Offers below this need the travel agent to write why they approve.", unit: "%" },
  { key: "validity_days", label: "Quotation valid for", hint: "After this, the offer is marked expired and rates must be rechecked.", unit: "days" },
  { key: "deposit_pct", label: "Deposit to confirm", hint: "Shown on the quotation's payment schedule.", unit: "%" },
  { key: "balance_days_before", label: "Balance due", hint: "How many days before departure the balance must be paid.", unit: "days before" },
];
const CLOCK: { key: NumKey; label: string; hint: string; unit: string }[] = [
  { key: "urgent_hours", label: "Solve urgent cases within", hint: "On-trip emergencies, lost passports, flight, hotel and payment problems. Colour changes every quarter of this time.", unit: "hours" },
  { key: "important_hours", label: "Solve important cases within", hint: "Other complaints, change requests and low after-trip ratings.", unit: "hours" },
  { key: "urgent_reply_minutes", label: "First reply on urgent cases", hint: "How soon someone must answer the customer.", unit: "minutes" },
  { key: "important_reply_minutes", label: "First reply on important cases", hint: "", unit: "minutes" },
  { key: "request_reply_hours", label: "First reply on new quotation requests and messages", hint: "The same green to overdue colours show in Requests and the Inbox.", unit: "hours" },
];

export default function Settings() {
  const [s, setS] = useState<S | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { api.settings().then(setS).catch(setErr); }, []);
  if (!s) return err ? <ErrorBox error={err} /> : <Spinner />;
  const save = async () => { setErr(null); setSaved(false); try { setS(await api.saveSettings(s)); setSaved(true); } catch (e) { setErr(e); } };
  const rows = (fields: typeof PRICING) => (
    <div className="divide-y divide-ivory-200">
      {fields.map((f) => (
        <label key={f.key} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <span className="min-w-0 max-w-md"><span className="block text-sm font-medium text-ink-900">{f.label}</span>{f.hint && <span className="block text-xs text-ink-400">{f.hint}</span>}</span>
          <span className="flex items-center gap-2"><input type="number" className="input w-24 text-right" value={s[f.key]} onChange={(e) => setS({ ...s, [f.key]: Number(e.target.value) })} /><span className="w-24 text-sm text-ink-500">{f.unit}</span></span>
        </label>
      ))}
    </div>
  );
  return (
    <>
      <PageHeader eyebrow="Settings" title="Pricing, quotations and the Response Clock" description="Changes apply to new estimates, offers, quotations and cases." />
      <div className="space-y-6">
        <Card title="Pricing and quotations">{rows(PRICING)}</Card>
        <Card title="Response Clock targets">{rows(CLOCK)}</Card>
        <ErrorBox error={err} />
        <div className="flex items-center justify-end gap-3">{saved && <span className="text-sm text-emerald-700">Saved.</span>}<button className="btn-primary" onClick={save}>Save settings</button></div>
      </div>
    </>
  );
}
