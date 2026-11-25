import { useEffect, useState } from "react";
import { api } from "../api";
import FeedbackDrawer from "../components/FeedbackDrawer";
import FeedbackTable from "../components/FeedbackTable";
import FilterBar, { useFilters } from "../components/FilterBar";
import { ErrorBox, PageHeader, Spinner } from "../components/ui";
import { presetRange } from "../lib/format";
import { useAsync } from "../lib/useAsync";

const TABS = [
  { k: "critical,high", l: "Critical & high" }, { k: "critical", l: "Critical" }, { k: "high", l: "High" }, { k: "medium", l: "Medium" }, { k: "low", l: "Low" },
];

export default function Priority() {
  const { f, set, setF } = useFilters({ ...presetRange(90), priority: "critical,high" });
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const q = { ...f, action: onlyOpen ? "unresolved" : undefined };
  useEffect(() => setPage(1), [JSON.stringify(f), onlyOpen]);
  const { data, error, loading, reload } = useAsync(() => api.feedback(q, page, 25), [JSON.stringify(q), page]);

  return (
    <>
      <PageHeader title="Priority Concerns" description="Urgency is assessed separately from sentiment: a neutral question can be critical, and a negative comment is not automatically urgent. Each item explains why it got its level." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => <button key={t.k} onClick={() => set("priority", t.k)} className={f.priority === t.k ? "btn-primary" : "btn-secondary"}>{t.l}</button>)}
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />Hide resolved</label>
      </div>
      <FilterBar f={f} set={set} setF={setF} fields={["platform", "sentiment", "topic", "search"]} />
      <ErrorBox error={error} />
      {loading && !data ? <Spinner /> : data && <FeedbackTable data={data} page={page} pageSize={25} onPage={setPage} onOpen={setOpen} />}
      <FeedbackDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />
    </>
  );
}
