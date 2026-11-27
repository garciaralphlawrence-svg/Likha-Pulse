import clsx from "clsx";
import { Download } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import { Card, Empty, ErrorBox, PageHeader, Spinner, Stat } from "../components/ui";
import { useAsync } from "../lib/useAsync";
import { dur } from "../quote/clock";
import { teamReportCsv } from "../quote/care";

const m = (x: number | null) => (x === null ? "—" : dur(x * 60000));
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (ym: string) => `${MONTH[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

/** Who handled each message, request and case, how fast they replied and how fast they solved it. */
export default function TeamReport() {
  const [months, setMonths] = useState(3);
  const { data: r, loading, error } = useAsync(() => api.teamReport(months), [months]);
  const download = () => {
    if (!r) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + teamReportCsv(r.rows)], { type: "text/csv;charset=utf-8" }));
    a.download = `paph-team-response-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <>
      <PageHeader eyebrow="Team report" title="Team response report" description="Messages, quotation requests and cases each person handled, their first-reply time and time to solve." actions={<button className="btn-secondary" onClick={download} disabled={!r}><Download className="h-4 w-4" />Download CSV</button>} />
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-full border border-ivory-300 bg-white p-1 sm:inline-flex">
        {[1, 3, 6].map((n) => <button key={n} onClick={() => setMonths(n)} className={clsx("shrink-0 rounded-full px-4 py-2 text-sm", months === n ? "bg-ink-900 text-ivory-50" : "text-ink-500")}>Last {n} month{n > 1 ? "s" : ""}</button>)}
      </div>
      <ErrorBox error={error} />
      {loading || !r ? <Spinner /> : !r.rows.length ? <Empty title="Nothing handled in this period" /> : (
        <div className="space-y-6">
          <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Handled" value={r.totals.handled} hint={`${r.totals.replied} replied`} />
            <Stat label="First reply" value={m(r.totals.avg_first_reply_minutes)} hint="average" />
            <Stat label="Cases solved" value={r.totals.solved} hint={`avg ${m(r.totals.avg_resolution_minutes)}`} />
            <Stat label="Cases on time" value={r.totals.cases_on_time_pct === null ? "—" : `${r.totals.cases_on_time_pct}%`} tone="gold" />
          </div>
          <Card title="By person">
            <div className="-mx-1 overflow-x-auto px-1"><table className="w-full min-w-[600px] text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-400">{["Name", "Handled", "Replied", "First reply", "Cases solved", "Time to solve", "On time"].map((h, i) => <th key={h} className={clsx("pb-2 font-medium", i && "text-right")}>{h}</th>)}</tr></thead>
              <tbody>{r.staff.map((x) => <tr key={x.name} className="border-t border-ivory-200"><td className="py-2">{x.name}</td><td className="py-2 text-right">{x.handled}</td><td className="py-2 text-right">{x.replied}</td><td className="py-2 text-right">{m(x.avg_first_reply_minutes)}</td><td className="py-2 text-right">{x.solved}</td><td className="py-2 text-right">{m(x.avg_resolution_minutes)}</td><td className="py-2 text-right">{x.cases_on_time_pct === null ? "—" : `${x.cases_on_time_pct}%`}</td></tr>)}</tbody>
            </table></div>
          </Card>
          <Card title="By month">
            <div className="-mx-1 overflow-x-auto px-1"><table className="w-full min-w-[520px] text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-400">{["Month", "Name", "Handled", "First reply", "Solved"].map((h, i) => <th key={h} className={clsx("pb-2 font-medium", i > 1 && "text-right")}>{h}</th>)}</tr></thead>
              <tbody>{r.by_month.map((x) => <tr key={x.month + x.name} className="border-t border-ivory-200"><td className="py-2">{monthLabel(x.month)}</td><td className="py-2">{x.name}</td><td className="py-2 text-right">{x.handled}</td><td className="py-2 text-right">{m(x.avg_first_reply_minutes)}</td><td className="py-2 text-right">{x.solved}</td></tr>)}</tbody>
            </table></div>
          </Card>
        </div>
      )}
    </>
  );
}
