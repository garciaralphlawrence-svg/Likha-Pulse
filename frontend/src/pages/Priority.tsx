import { useEffect, useState } from "react";
import { api } from "../api";
import FeedbackDrawer from "../components/FeedbackDrawer";
import FeedbackTable from "../components/FeedbackTable";
import FilterBar, { useFilters } from "../components/FilterBar";
import { ErrorBox, PageHeader, Spinner } from "../components/ui";
import { presetRange } from "../lib/format";
import { useAsync } from "../lib/useAsync";

const TABS = [
  { k: "critical,high", l: "Urgent & important" }, { k: "critical", l: "Urgent" }, { k: "high", l: "Important" }, { k: "medium", l: "Follow up" }, { k: "low", l: "No rush" },
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
      <PageHeader eyebrow="Needs attention" title="Reply to these first" description="Messages the AI thinks you should handle soon — like stranded travelers, safety concerns, angry customers, or people still waiting for an answer." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => <button key={t.k} onClick={() => set("priority", t.k)} className={f.priority === t.k ? "btn-primary" : "btn-secondary"}>{t.l}</button>)}
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-500"><input type="checkbox" className="accent-gold-500" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />Hide messages marked done</label>
      </div>
      <FilterBar f={f} set={set} setF={setF} fields={["search", "platform", "topic"]} />
      <ErrorBox error={error} />
      {loading && !data ? <Spinner /> : data && <FeedbackTable data={data} page={page} pageSize={25} onPage={setPage} onOpen={setOpen} />}
      <FeedbackDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />
    </>
  );
}
