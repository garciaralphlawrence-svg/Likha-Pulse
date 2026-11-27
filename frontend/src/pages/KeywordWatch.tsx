// Keyword watch: the owner picks words (refund, scam, cancel, a destination). Matching messages are flagged and raise an alert.
import clsx from "clsx";
import { Eye, Plus, Save, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import FeedbackDrawer from "../components/FeedbackDrawer";
import FeedbackTable from "../components/FeedbackTable";
import { Card, ErrorBox, PageHeader, Spinner } from "../components/ui";
import { useAuth } from "../lib/auth";
import { cleanWords } from "../lib/teamtools";
import { useAsync } from "../lib/useAsync";

const RANGES = [{ d: 7, l: "This week" }, { d: 30, l: "This month" }, { d: 90, l: "3 months" }, { d: 365, l: "This year" }];

export default function KeywordWatch() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [days, setDays] = useState(30);
  const [only, setOnly] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(params.get("open"));
  const { data, error, loading, reload } = useAsync(() => api.keywordWatch(days), [days]);
  const [words, setWords] = useState<string[] | null>(null);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const edit = can("settings.manage");
  useEffect(() => { if (data && words === null) setWords(data.words); }, [data, words]);
  useEffect(() => setPage(1), [days, only]);
  const dirty = !!data && !!words && words.join("|") !== data.words.join("|");

  const add = (e: FormEvent) => {
    e.preventDefault();
    const next = cleanWords([...(words ?? []), ...draft.split(",")]);
    setWords(next); setDraft("");
  };
  const save = async () => {
    setErr(null);
    try { await api.saveSetting("keyword_watch", { words: words ?? [] }); setSaved(true); setTimeout(() => setSaved(false), 2500); await reload(); } catch (e) { setErr(e); }
  };
  const items = (data?.items ?? []).filter((x) => !only || x.watch_hits.includes(only));
  const PAGE = 20;

  return (
    <>
      <PageHeader eyebrow="Keyword watch" title="Words you never want to miss"
        description="Pick words like refund, scam, cancel or a destination. Any message that mentions one is flagged in the Inbox and sends you an alert." />
      <ErrorBox error={error || err} />
      <Card title="Your watch words" subtitle={edit ? "Type a word and press Add. “cancel” also catches “cancelled”." : "Only the owner can change these."} className="mb-6"
        action={edit && <button className="btn-primary" disabled={!dirty} onClick={save}><Save className="h-4 w-4" />{saved ? "Saved" : "Save words"}</button>}>
        <div className="flex flex-wrap items-center gap-2">
          {(words ?? []).map((w) => (
            <span key={w} className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 py-1.5 pl-3.5 pr-2 text-sm text-ivory-50">
              <Eye className="h-3.5 w-3.5 text-gold-300" />{w}
              {edit && <button aria-label={`Remove ${w}`} className="rounded-full p-0.5 text-ink-400 hover:bg-white/10 hover:text-ivory-50" onClick={() => setWords((words ?? []).filter((x) => x !== w))}><X className="h-3.5 w-3.5" /></button>}
            </span>
          ))}
          {!words?.length && <span className="text-sm text-ink-400">No watch words yet.</span>}
        </div>
        {edit && (
          <form onSubmit={add} className="mt-4 flex max-w-md gap-2">
            <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. refund, Siargao" aria-label="New watch word" maxLength={120} />
            <button className="btn-secondary shrink-0" disabled={!draft.trim()}><Plus className="h-4 w-4" />Add</button>
          </form>
        )}
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex max-w-full overflow-x-auto rounded-full border border-ivory-300 bg-white p-1">
          {RANGES.map((r) => <button key={r.d} onClick={() => setDays(r.d)} className={clsx("whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition", days === r.d ? "bg-ink-900 text-ivory-50" : "text-ink-500 hover:text-ink-900")}>{r.l}</button>)}
        </div>
      </div>
      {loading && !data ? <Spinner /> : data && (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            <button onClick={() => setOnly(null)} className={clsx("rounded-full border px-3.5 py-1.5 text-sm transition", !only ? "border-gold-500 bg-gold-50 text-gold-700" : "border-ivory-300 bg-white text-ink-600 hover:border-gold-300")}>All matches · {data.total}</button>
            {data.counts.map((c) => (
              <button key={c.word} onClick={() => setOnly(only === c.word ? null : c.word)} className={clsx("rounded-full border px-3.5 py-1.5 text-sm transition", only === c.word ? "border-gold-500 bg-gold-50 text-gold-700" : "border-ivory-300 bg-white text-ink-600 hover:border-gold-300")}>{c.word} · {c.count}</button>
            ))}
          </div>
          <FeedbackTable data={{ total: items.length, page, page_size: PAGE, items: items.slice((page - 1) * PAGE, page * PAGE) }} page={page} pageSize={PAGE} onPage={setPage} onOpen={setOpen} />
        </>
      )}
      <FeedbackDrawer id={open} onClose={() => { setOpen(null); if (params.get("open")) { params.delete("open"); setParams(params); } }} onChanged={reload} />
    </>
  );
}
