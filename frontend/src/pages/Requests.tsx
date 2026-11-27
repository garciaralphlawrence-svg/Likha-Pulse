import clsx from "clsx";
import { AlertTriangle, ChevronRight, Clock, HelpCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { RequestSummary } from "../api/types";
import { Empty, ErrorBox, PageHeader, SampleTag, Spinner, StatusBadge, Tag } from "../components/ui";
import { useAuth } from "../lib/auth";
import { ago, peso } from "../lib/format";
import { useAsync } from "../lib/useAsync";

type View = "queue" | "approval" | "open" | "closed" | "all";
const TABS: { v: View; label: string }[] = [
  { v: "queue", label: "To do" }, { v: "approval", label: "Waiting for approval" }, { v: "open", label: "All open" }, { v: "closed", label: "Closed" },
];

export function RequestRow({ r }: { r: RequestSummary }) {
  const late = r.flags.waiting_hours >= 24;
  return (
    <li>
      <Link to={`/staff/requests/${r.id}`} className={clsx("group flex flex-col gap-3 rounded-2xl border bg-white p-4 transition hover:border-gold-300 hover:shadow-card sm:flex-row sm:items-center sm:p-5", late ? "border-red-200 bg-red-50/30" : "border-ivory-200")}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-wide text-ink-400">{r.ref}</span>
            <StatusBadge status={r.status} />
            {late && <Tag tone="red"><Clock className="mr-1 h-3 w-3" />Waiting {r.flags.waiting_hours}h</Tag>}
            {r.flags.question && <Tag tone="gold"><HelpCircle className="mr-1 h-3 w-3" />Customer question</Tag>}
            {r.flags.expired && <Tag tone="red">Expired: recheck rates</Tag>}
            {r.flags.below_cost && <Tag tone="red"><AlertTriangle className="mr-1 h-3 w-3" />Below cost</Tag>}
            {r.flags.low_margin && <Tag tone="gold">Thin margin</Tag>}
            {r.flags.budget_too_low && <Tag>Budget too low</Tag>}
            {r.is_sample && <SampleTag />}
          </div>
          <p className="mt-1.5 font-display text-xl font-semibold leading-tight text-ink-900">{r.customer_name}: {r.destination_name}, {r.days} days, {r.pax} pax</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-ink-500">{r.verdict}</p>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-5 text-sm sm:justify-end">
          <div className="text-left sm:text-right">
            {r.offer_price !== null ? (<><p className="font-semibold text-ink-900">{peso(r.offer_price)}</p><p className="text-xs text-ink-400">offer{r.margin_pct !== null ? ` · margin ${r.margin_pct}%` : ""}</p></>)
              : r.ai_low !== null ? (<><p className="font-semibold text-ink-900">{peso(r.ai_low)}–{peso(r.ai_high!)}</p><p className="text-xs text-ink-400">AI range</p></>) : <p className="text-xs text-ink-400">Needs manual pricing</p>}
          </div>
          <div className="text-right text-xs text-ink-400"><p>{r.assignee ?? "Unassigned"}</p><p>{ago(r.updated_at)}</p></div>
          <ChevronRight className="hidden h-5 w-5 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-gold-600 sm:block" />
        </div>
      </Link>
    </li>
  );
}

export default function Requests({ initial }: { initial?: View }) {
  const { can, user } = useAuth();
  const [view, setView] = useState<View>(initial ?? (user?.role === "AGENT" ? "approval" : "queue"));
  const { data, loading, error } = useAsync(() => api.requests(view), [view]);
  const late = data?.filter((r) => r.flags.waiting_hours >= 24).length ?? 0;
  return (
    <>
      <PageHeader eyebrow={initial === "approval" ? "Approvals" : "Requests"} title={initial === "approval" ? "Offers waiting for your decision" : "Customer requests"}
        description={initial === "approval" ? "Check each offer against the AI range and the margin, then approve, ask for changes or decline." : can("requests.sell") ? "New requests arrive with an AI price range and plan. Take one, prepare the offer, and send it for approval." : "Every request and where it stands."} />
      {!initial && (
        <div className="mb-5 flex gap-1 overflow-x-auto rounded-full border border-ivory-300 bg-white p-1 sm:inline-flex">
          {TABS.map((t) => <button key={t.v} onClick={() => setView(t.v)} className={clsx("shrink-0 rounded-full px-4 py-2 text-sm transition", view === t.v ? "bg-ink-900 text-ivory-50" : "text-ink-500 hover:text-ink-900")}>{t.label}</button>)}
        </div>
      )}
      {late > 0 && view === "queue" && <p className="mb-4 flex items-center gap-2 text-sm text-red-800"><Clock className="h-4 w-4" />{late} request{late > 1 ? "s have" : " has"} waited more than 24 hours. Please reply first.</p>}
      <ErrorBox error={error} />
      {loading ? <Spinner /> : !data?.length ? <Empty title="Nothing here right now">All caught up.</Empty> : <ul className="stagger space-y-3">{data.map((r) => <RequestRow key={r.id} r={r} />)}</ul>}
    </>
  );
}
