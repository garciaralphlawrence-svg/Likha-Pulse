// Import past feedback from Excel (.xlsx) or CSV: pick the file, match the columns, check the preview, then import.
import clsx from "clsx";
import { CheckCircle2, Download, FileSpreadsheet, FileUp, RotateCcw } from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, IS_DEMO } from "../api";
import type { ImportResult, ImportRow } from "../api/types";
import TEMPLATE from "../demo/import_template.csv?raw";
import { Card, ErrorBox, PageHeader } from "../components/ui";
import { PLATFORM_LABEL, fmtDate } from "../lib/format";
import { IMPORT_FIELDS, ImportField, Mapping, channelCode, parseDate, readTable } from "../lib/teamtools";

const FIELD_LABEL: Record<ImportField, [string, string]> = {
  date: ["Date", "When the message was sent"], client: ["Client name", "Optional: groups messages per client"],
  message: ["Message", "What the traveler said"], channel: ["Channel", "Optional: Facebook, Messenger, survey…"],
};

function downloadTemplate() {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + TEMPLATE], { type: "text/csv" }));
  a.download = "likha-pulse-import-template.csv"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function ImportPage() {
  const [file, setFile] = useState<{ name: string; columns: string[]; rows: string[][] } | null>(null);
  const [map, setMap] = useState<Mapping>({ date: null, client: null, message: null, channel: null });
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setErr(null); setResult(null); setFile(null);
    if (f.size > 10 * 1024 * 1024) { setErr(new Error("The file is larger than 10 MB. Split it into smaller files.")); return; }
    try { const t = await readTable(f); setFile({ name: f.name, columns: t.columns, rows: t.rows }); setMap(t.mapping); } catch (x) { setErr(x); }
  };
  const mapped: ImportRow[] = useMemo(() => (file ? file.rows.map((r) => ({
    date: map.date !== null ? r[map.date] ?? "" : "", client: map.client !== null ? r[map.client] ?? "" : "",
    message: map.message !== null ? r[map.message] ?? "" : "", channel: map.channel !== null ? r[map.channel] ?? "" : "",
  })) : []), [file, map]);
  const checks = useMemo(() => mapped.map((r) => (r.message.trim().length < 2 ? "No message" : !parseDate(r.date) ? "Date not readable" : null)), [mapped]);
  const ready = checks.filter((c) => !c).length;
  const run = async () => {
    if (!file) return;
    setBusy(true); setErr(null);
    try { setResult(await api.importRows(file.name, mapped)); setFile(null); } catch (x) { setErr(x); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader eyebrow="Import past feedback" title="Bring in your old messages"
        description="Upload old surveys or past messages from Excel or CSV, so your history and trends start full. The AI reads every row. Imported messages are saved as history: they count in charts and client history but do not open new cases or alerts." />
      <ErrorBox error={err} />
      {result && (
        <Card className="mb-6" title={<span className="inline-flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-700" />{result.imported} message{result.imported === 1 ? "" : "s"} imported</span>}
          subtitle={`From ${result.total} rows · ${result.duplicates} already in the system · ${result.skipped_count} skipped`}>
          <p className="text-sm text-ink-600">{Object.entries(result.by_channel).map(([k, n]) => `${PLATFORM_LABEL[k] ?? k}: ${n}`).join(" · ") || "Nothing new was added."}</p>
          {result.skipped.length > 0 && <p className="mt-2 text-xs text-ink-400">Skipped: {result.skipped.slice(0, 12).map((s) => `row ${s.row} (${s.reason.toLowerCase()})`).join(", ")}{result.skipped_count > 12 ? "…" : ""}</p>}
          <div className="mt-4 flex flex-wrap gap-2"><Link to="/feedback?" className="btn-primary">Open the Inbox</Link><button className="btn-secondary" onClick={() => setResult(null)}><RotateCcw className="h-4 w-4" />Import another file</button></div>
        </Card>
      )}

      {!file && !result && (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <label className="card flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed border-ivory-300 p-10 text-center transition hover:border-gold-300 hover:bg-gold-50/40">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink-900 text-gold-300"><FileUp className="h-6 w-6" /></span>
            <span className="font-display text-2xl font-semibold text-ink-900">Choose an Excel or CSV file</span>
            <span className="text-sm text-ink-400">.xlsx or .csv · first row = column names · up to 5,000 rows</span>
            <input type="file" accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={pick} />
          </label>
          <Card title="Not sure how to set it up?" subtitle="Start from our sample file">
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-600">
              <li><b>date</b>: e.g. 2025-10-04 or 10/04/2025</li>
              <li><b>client name</b>: optional, groups messages per client</li>
              <li><b>message</b>: what the traveler wrote</li>
              <li><b>channel</b>: Facebook comment, Messenger, survey…</li>
            </ul>
            <button className="btn-secondary mt-4" onClick={downloadTemplate}><Download className="h-4 w-4" />Download sample CSV</button>
            {IS_DEMO && <p className="mt-3 text-xs text-ink-400">Preview: files are read here in your browser and stay in this browser only.</p>}
          </Card>
        </div>
      )}

      {file && (
        <div className="space-y-6">
          <Card title={<span className="inline-flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-emerald-700" />{file.name}</span>} subtitle={`${file.rows.length} rows found. Tell us which column is which.`}
            action={<button className="btn-ghost" onClick={() => setFile(null)}>Choose another file</button>}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {IMPORT_FIELDS.map((f) => (
                <label key={f} className="block">
                  <span className="label">{FIELD_LABEL[f][0]}{(f === "date" || f === "message") && " *"}</span>
                  <select className="input" value={map[f] ?? ""} onChange={(e) => setMap({ ...map, [f]: e.target.value === "" ? null : Number(e.target.value) })}>
                    <option value="">{f === "date" || f === "message" ? "Choose a column" : "Not in this file"}</option>
                    {file.columns.map((c, i) => <option key={i} value={i}>{c}</option>)}
                  </select>
                  <span className="text-xs text-ink-400">{FIELD_LABEL[f][1]}</span>
                </label>
              ))}
            </div>
          </Card>
          <Card title="Preview" subtitle="The first 8 rows, the way they will be saved">
            <div className="-mx-6 overflow-x-auto px-6">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="text-left text-[11px] uppercase tracking-[0.14em] text-ink-400"><th className="py-2 font-medium">Date</th><th className="font-medium">Client</th><th className="font-medium">Message</th><th className="font-medium">Saved as</th><th className="font-medium">Check</th></tr></thead>
                <tbody className="divide-y divide-ivory-200">
                  {mapped.slice(0, 8).map((r, i) => { const d = parseDate(r.date); return (
                    <tr key={i} className="align-top">
                      <td className="whitespace-nowrap py-2.5 pr-3">{d ? fmtDate(d, false) : <span className="text-red-800">{r.date || "—"}</span>}</td>
                      <td className="pr-3">{r.client || "—"}</td>
                      <td className="max-w-md pr-3 text-ink-700">{r.message || "—"}</td>
                      <td className="whitespace-nowrap pr-3">{PLATFORM_LABEL[channelCode(r.channel)]}</td>
                      <td className={clsx("whitespace-nowrap text-xs", checks[i] ? "text-red-800" : "text-emerald-700")}>{checks[i] ?? "Ready"}</td>
                    </tr>); })}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-ivory-200 pt-4">
              <button className="btn-gold" disabled={busy || !ready || map.message === null || map.date === null} onClick={run}><FileUp className="h-4 w-4" />{busy ? "Reading every message…" : `Import ${ready} message${ready === 1 ? "" : "s"}`}</button>
              <span className="text-sm text-ink-500">{file.rows.length - ready > 0 ? `${file.rows.length - ready} row${file.rows.length - ready === 1 ? "" : "s"} will be skipped (no message or unreadable date).` : "Every row looks good."}</span>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
