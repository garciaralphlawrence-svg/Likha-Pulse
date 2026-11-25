import { useState } from "react";
import { api } from "../api";
import { Card, Empty, ErrorBox, PageHeader, Select, Spinner } from "../components/ui";
import { fmtDate, pretty } from "../lib/format";
import { useAsync } from "../lib/useAsync";

const ACTIONS = ["login", "login_failed", "feedback_added", "feedback_reviewed", "feedback_status", "feedback_reanalyzed", "insight_generated", "report_generated",
  "integration_sync", "sample_data_loaded", "sample_data_deleted", "user_created", "user_updated", "setting_changed", "password_changed", "password_reset"];

export default function Audit() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const { data, loading, error } = useAsync(() => api.audit(action || undefined, page), [action, page]);
  return (
    <>
      <PageHeader title="Audit Logs" description="Who did what and when: logins, reviews, report generation, user and settings changes." />
      <div className="mb-4 w-64"><Select label="Action" value={action} onChange={(v) => { setAction(v); setPage(1); }} options={ACTIONS} /></div>
      <ErrorBox error={error} />
      <Card>
        {loading ? <Spinner /> : !data?.length ? <Empty title="No log entries" /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[800px]"><thead><tr>{["Time", "User", "Action", "Entity", "Details"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{data.map((r) => (
              <tr key={r.id}><td className="td whitespace-nowrap text-xs text-slate-500">{fmtDate(r.created_at)}</td><td className="td text-sm">{r.actor}</td>
                <td className="td text-sm font-medium">{pretty(r.action)}</td><td className="td text-xs text-slate-500">{r.entity}{r.entity_id && ` · ${r.entity_id.slice(0, 12)}`}</td>
                <td className="td max-w-md truncate font-mono text-xs text-slate-500" title={JSON.stringify(r.details)}>{JSON.stringify(r.details)}</td></tr>
            ))}</tbody></table></div>
        )}
        <div className="mt-3 flex justify-end gap-2"><button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</button><button className="btn-secondary" disabled={(data?.length ?? 0) < 50} onClick={() => setPage(page + 1)}>Older</button></div>
      </Card>
    </>
  );
}
