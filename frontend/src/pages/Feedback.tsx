import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import FeedbackDrawer from "../components/FeedbackDrawer";
import FeedbackTable from "../components/FeedbackTable";
import FilterBar, { useFilters } from "../components/FilterBar";
import { ErrorBox, Modal, PageHeader, Spinner } from "../components/ui";
import { useAuth } from "../lib/auth";
import { presetRange } from "../lib/format";
import { useAsync } from "../lib/useAsync";

export default function Feedback() {
  const [params, setParams] = useSearchParams();
  const { f, set, setF } = useFilters({ ...presetRange(90), priority: params.get("priority") ?? undefined, sentiment: params.get("sentiment") ?? undefined });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(params.get("open"));
  const [adding, setAdding] = useState(false);
  const { can } = useAuth();
  const PAGE = 25;
  useEffect(() => setPage(1), [JSON.stringify(f)]);
  useEffect(() => { const o = params.get("open"); if (o) setOpen(o); }, [params]);
  const { data, error, loading, reload } = useAsync(() => api.feedback(f, page, PAGE), [JSON.stringify(f), page]);

  return (
    <>
      <PageHeader title="Feedback Monitoring" description="Every collected comment, review and message with its AI analysis. Click a row for the full explanation and to validate the result."
        actions={can("feedback.manage") && <button className="btn-primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add feedback</button>} />
      <FilterBar f={f} set={set} setF={setF} fields={["platform", "sentiment", "priority", "emotion", "intent", "topic", "review", "action", "search"]} />
      <ErrorBox error={error} />
      {loading && !data ? <Spinner /> : data && <FeedbackTable data={data} page={page} pageSize={PAGE} onPage={setPage} onOpen={setOpen} />}
      <FeedbackDrawer id={open} onClose={() => { setOpen(null); if (params.get("open")) { params.delete("open"); setParams(params); } }} onChanged={reload} />
      <AddFeedback open={adding} onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); reload(); setOpen(id); }} />
    </>
  );
}

function AddFeedback({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (id: string) => void }) {
  const [content, setContent] = useState(""); const [author, setAuthor] = useState(""); const [rating, setRating] = useState("");
  const [err, setErr] = useState<unknown>(null); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { const d = await api.addFeedback(content, author, rating ? Number(rating) : null); setContent(""); setAuthor(""); setRating(""); onAdded(d.id); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add feedback manually">
      <p className="mb-3 text-xs text-slate-500">For feedback received outside connected platforms (phone, walk-in, email). It is analyzed immediately.</p>
      <label className="block"><span className="label">Feedback text</span><textarea className="input min-h-[110px]" value={content} onChange={(e) => setContent(e.target.value)} /></label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label><span className="label">Customer (optional, anonymized)</span><input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} /></label>
        <label><span className="label">Rating (optional)</span><select className="input" value={rating} onChange={(e) => setRating(e.target.value)}><option value="">None</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 && "s"}</option>)}</select></label>
      </div>
      <div className="mt-3"><ErrorBox error={err} /></div>
      <div className="mt-4 flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || content.trim().length < 2} onClick={submit}>{busy ? "Analyzing…" : "Add & analyze"}</button></div>
    </Modal>
  );
}
