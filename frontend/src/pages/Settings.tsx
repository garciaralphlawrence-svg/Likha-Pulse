import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, ErrorBox, PageHeader, Spinner } from "../components/ui";
import type { Settings as S } from "../quote/workflow";

const FIELDS: { key: keyof S; label: string; hint: string; unit: string }[] = [
  { key: "service_fee_pct", label: "PAPH service fee", hint: "Added on top of the costs in every AI estimate and new offer.", unit: "%" },
  { key: "min_margin_pct", label: "Lowest margin without a reason", hint: "Offers below this need the travel agent to write why they approve.", unit: "%" },
  { key: "validity_days", label: "Quotation valid for", hint: "After this, the offer is marked expired and rates must be rechecked.", unit: "days" },
  { key: "deposit_pct", label: "Deposit to confirm", hint: "Shown on the quotation's payment schedule.", unit: "%" },
  { key: "balance_days_before", label: "Balance due", hint: "How many days before departure the balance must be paid.", unit: "days before" },
];

export default function Settings() {
  const [s, setS] = useState<S | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { api.settings().then(setS).catch(setErr); }, []);
  if (!s) return err ? <ErrorBox error={err} /> : <Spinner />;
  const save = async () => { setErr(null); setSaved(false); try { setS(await api.saveSettings(s)); setSaved(true); } catch (e) { setErr(e); } };
  return (
    <>
      <PageHeader eyebrow="Settings" title="Pricing and quotation rules" description="These apply to new AI estimates, new offers and new quotations." />
      <Card>
        <div className="divide-y divide-ivory-200">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <span className="min-w-0 max-w-md"><span className="block text-sm font-medium text-ink-900">{f.label}</span><span className="block text-xs text-ink-400">{f.hint}</span></span>
              <span className="flex items-center gap-2"><input type="number" className="input w-24 text-right" value={s[f.key]} onChange={(e) => setS({ ...s, [f.key]: Number(e.target.value) })} /><span className="w-24 text-sm text-ink-500">{f.unit}</span></span>
            </label>
          ))}
        </div>
        <ErrorBox error={err} />
        <div className="mt-4 flex items-center justify-end gap-3">{saved && <span className="text-sm text-emerald-700">Saved.</span>}<button className="btn-primary" onClick={save}>Save settings</button></div>
      </Card>
    </>
  );
}
