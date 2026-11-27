import { useState } from "react";
import { api } from "../api";
import { Card, Empty, ErrorBox, PageHeader, Spinner } from "../components/ui";
import { fmtDate } from "../lib/format";
import { ACTIONS, ActionCode } from "../quote/workflow";
const pretty = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
import { useAsync } from "../lib/useAsync";

const LABEL: Record<string, string> = { login: "Signed in", login_failed: "Failed sign-in", user_created: "Added a person", user_updated: "Changed a person", setting_changed: "Changed settings", request_submitted: "Customer sent a request" };
const label = (a: string) => LABEL[a] ?? (a.startsWith("request_") ? (ACTIONS[a.slice(8) as ActionCode]?.label ?? pretty(a.slice(8))) : pretty(a));

export default function Audit() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useAsync(() => api.audit(page), [page]);
  return (
    <>
      <PageHeader eyebrow="Activity" title="Who did what" description="Sign-ins, offers, approvals and changes made by your team." />
      <ErrorBox error={error} />
      <Card>
        {loading ? <Spinner /> : !data?.length ? <Empty title="No activity yet" /> : (
          <ul className="divide-y divide-ivory-200">{data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-3 text-sm">
              <span className="min-w-0"><b className="font-medium">{label(r.action)}</b>{r.entity === "request" && r.entity_id && <span className="text-ink-500"> · {r.entity_id}</span>}<span className="block text-xs text-ink-400">{r.actor}</span></span>
              <span className="text-xs text-ink-400">{fmtDate(r.created_at)}</span>
            </li>
          ))}</ul>
        )}
        <div className="mt-3 flex justify-end gap-2"><button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</button><button className="btn-secondary" disabled={(data?.length ?? 0) < 50} onClick={() => setPage(page + 1)}>Older</button></div>
      </Card>
    </>
  );
}
