// Suggested replies library: ready answers in English and Taglish that the team can edit, add and save.
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import type { ReplyTemplate, TemplateInput } from "../api/types";
import { CopyButton } from "../components/SuggestedReplies";
import { ErrorBox, Modal, PageHeader, Select, Spinner, Tag } from "../components/ui";
import { useAuth } from "../lib/auth";
import { fmtDate } from "../lib/format";
import { useAsync } from "../lib/useAsync";

const EMPTY: TemplateInput = { situation: "thank_you", language: "tl", title: "", body: "" };

export default function Replies() {
  const { can } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.replyTemplates(), []);
  const [lang, setLang] = useState("");
  const [sit, setSit] = useState("");
  const [edit, setEdit] = useState<{ id?: number; t: TemplateInput } | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const manage = can("feedback.manage");

  const save = async () => {
    if (!edit) return;
    setBusy(true); setErr(null);
    try { await api.saveTemplate(edit.t, edit.id); setEdit(null); reload(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const remove = async (t: ReplyTemplate) => {
    if (!confirm(`Delete the reply “${t.title}”?`)) return;
    try { await api.deleteTemplate(t.id); reload(); } catch (e) { setErr(e); }
  };
  const items = (data?.items ?? []).filter((t) => (!lang || t.language === lang) && (!sit || t.situation === sit));
  const groups = Object.entries(data?.situations ?? {}).map(([k, label]) => ({ k, label, list: items.filter((t) => t.situation === k) })).filter((g) => g.list.length);

  return (
    <>
      <PageHeader eyebrow="Suggested replies" title="Ready replies for every situation"
        description="When you open a message, the best reply for it is shown with a Copy button. Edit these to sound like your agency. Replies are copied, never sent automatically."
        actions={manage && <button className="btn-primary" onClick={() => { setErr(null); setEdit({ t: { ...EMPTY } }); }}><Plus className="h-4 w-4" />New reply</button>} />
      <div className="mb-5 flex flex-wrap gap-2">
        <div className="w-48"><Select value={sit} onChange={setSit} options={Object.entries(data?.situations ?? {}).map(([value, label]) => ({ value, label }))} placeholder="Every situation" /></div>
        <div className="w-40"><Select value={lang} onChange={setLang} options={[{ value: "tl", label: "Taglish" }, { value: "en", label: "English" }]} placeholder="Both languages" /></div>
      </div>
      <ErrorBox error={error || (!edit && err)} />
      {loading && !data ? <Spinner /> : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.k}>
              <h2 className="mb-3 font-display text-2xl font-semibold text-ink-900">{g.label}</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {g.list.map((t) => (
                  <article key={t.id} className="card flex flex-col p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 flex-1 font-medium text-ink-900">{t.title}</p>
                      <Tag tone={t.language === "tl" ? "gold" : "slate"}>{t.language === "tl" ? "Taglish" : "English"}</Tag>
                    </div>
                    <p className="mt-2 flex-1 whitespace-pre-line text-[15px] leading-relaxed text-ink-700">{t.body}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ivory-200 pt-3">
                      <CopyButton text={t.body} />
                      {manage && <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => { setErr(null); setEdit({ id: t.id, t: { situation: t.situation, language: t.language, title: t.title, body: t.body } }); }}><Pencil className="h-3.5 w-3.5" />Edit</button>}
                      {manage && <button className="btn-ghost px-3 py-1.5 text-xs text-red-800" onClick={() => remove(t)}><Trash2 className="h-3.5 w-3.5" />Delete</button>}
                      <span className="ml-auto text-[11px] text-ink-400">{t.is_default && t.updated_by === "Likha Pulse" ? "Ready-made" : `Saved by ${t.updated_by}${t.updated_at ? ` · ${fmtDate(t.updated_at, false)}` : ""}`}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
          {!groups.length && <p className="text-sm text-ink-400">No replies match these filters.</p>}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit reply" : "New reply"}>
        {edit && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Select label="Situation" placeholder={null} value={edit.t.situation} onChange={(v) => setEdit({ ...edit, t: { ...edit.t, situation: v } })} options={Object.entries(data?.situations ?? {}).map(([value, label]) => ({ value, label }))} />
              <Select label="Language" placeholder={null} value={edit.t.language} onChange={(v) => setEdit({ ...edit, t: { ...edit.t, language: v as "en" | "tl" } })} options={[{ value: "tl", label: "Taglish" }, { value: "en", label: "English" }]} />
            </div>
            <label className="block"><span className="label">Short title</span><input className="input" maxLength={120} value={edit.t.title} onChange={(e) => setEdit({ ...edit, t: { ...edit.t, title: e.target.value } })} placeholder="e.g. Refund sent through GCash" /></label>
            <label className="block"><span className="label">Reply</span><textarea className="input min-h-[150px]" maxLength={2000} value={edit.t.body} onChange={(e) => setEdit({ ...edit, t: { ...edit.t, body: e.target.value } })} placeholder="Write it the way your team talks to travelers." /></label>
            <p className="text-xs text-ink-400">Tip: leave blanks like [booking name] or [time] for the team to fill in before sending.</p>
            <ErrorBox error={err} />
            <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" disabled={busy || edit.t.title.trim().length < 2 || edit.t.body.trim().length < 5} onClick={save}>{busy ? "Saving…" : "Save reply"}</button></div>
          </div>
        )}
      </Modal>
    </>
  );
}
