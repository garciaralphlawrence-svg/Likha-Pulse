import { Download, FileSpreadsheet, FileText, Sheet } from "lucide-react";
import { useState } from "react";
import { api, IS_DEMO } from "../api";
import FilterBar, { useFilters } from "../components/FilterBar";
import { Card, Empty, ErrorBox, PageHeader, Select, Spinner } from "../components/ui";
import { useAuth } from "../lib/auth";
import { fmtDate } from "../lib/format";
import { useAsync } from "../lib/useAsync";

const ICON: Record<string, JSX.Element> = { pdf: <FileText className="h-4 w-4 text-red-600" />, xlsx: <FileSpreadsheet className="h-4 w-4 text-emerald-700" />, csv: <Sheet className="h-4 w-4 text-slate-600" /> };

export default function Reports() {
  const { can } = useAuth();
  const types = useAsync(() => api.reportTypes(), []);
  const list = useAsync(() => api.reports(), []);
  const { f, set, setF } = useFilters();
  const [type, setType] = useState("overall");
  const [format, setFormat] = useState("pdf");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const create = async () => {
    setBusy(true); setErr(null);
    try { const r = await api.createReport(type, format, f); await list.reload(); await api.downloadReport(r); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Reports" description="Each report includes the reporting period, totals, sentiment distribution, charts, key observations, common issues and recommendations." />
      {can("reports.generate") && (
        <Card title="Generate a report" className="mb-5">
          <div className="grid gap-3 md:grid-cols-3">
            <Select label="Report" placeholder={null} value={type} onChange={setType} options={(types.data ?? []).map((t) => ({ value: t.code, label: t.name }))} />
            <Select label="Format" placeholder={null} value={format} onChange={setFormat} options={[{ value: "pdf", label: "PDF" }, { value: "xlsx", label: "Excel" }, { value: "csv", label: "CSV" }]} />
            <div className="flex items-end"><button className="btn-primary w-full" onClick={create} disabled={busy}><Download className="h-4 w-4" />{busy ? "Generating…" : "Generate & download"}</button></div>
          </div>
          {type === "platform" && <p className="mt-2 text-xs text-amber-700">Choose a platform in the filters below.</p>}
          {type === "monthly" && <p className="mt-2 text-xs text-slate-500">Uses the selected period, or the current month if no start date is set.</p>}
          {IS_DEMO && <p className="mt-2 text-xs text-slate-500">Demo: PDF opens a print-ready page (save as PDF); Excel downloads a spreadsheet file. The server version generates native PDF and .xlsx files with charts.</p>}
          <div className="mt-4"><FilterBar f={f} set={set} setF={setF} fields={["platform", "sentiment"]} /></div>
          <ErrorBox error={err} />
        </Card>
      )}
      <Card title="Generated reports">
        {list.loading ? <Spinner /> : !list.data?.length ? <Empty title="No reports yet" /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px]"><thead><tr>{["Report", "Format", "Period", "Created", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{list.data.map((r) => (
              <tr key={r.id}><td className="td font-medium">{r.name}</td><td className="td"><span className="inline-flex items-center gap-1.5 uppercase">{ICON[r.file_format]}{r.file_format}</span></td>
                <td className="td text-sm text-slate-600">{fmtDate(r.period.from, false)} – {fmtDate(r.period.to, false)}</td><td className="td text-sm text-slate-500">{fmtDate(r.created_at)}</td>
                <td className="td text-right"><button className="btn-secondary" onClick={() => api.downloadReport(r).catch(setErr)}><Download className="h-4 w-4" />Download</button></td></tr>
            ))}</tbody></table></div>
        )}
      </Card>
    </>
  );
}
