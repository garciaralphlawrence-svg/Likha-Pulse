import { Check, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import type { ReplyTemplate } from "../api/types";
import { Card, ErrorBox, Modal, PageHeader, Select, Spinner, Tag } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useAsync } from "../lib/useAsync";
import { REPLY_LANGUAGES, REPLY_SITUATIONS } from "../quote/care";

const blank = { situation: "price", language: "tl" as "en" | "tl", title: "", body: "" };

/** Ready replies the team copies into Messenger or Facebook. Nothing is ever sent automatically. */
export default function Replies() {
  const { can } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.replyTemplates(), []);
  const [lang, setLang] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [edit, setEdit] = useState<{ id?: number; t: typeof blank } | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const copy = async (t: ReplyTemplate) => { try { await navigator.clipboard.writeText(t.body); } catch { /* ignore */ } setCopied(t.id); setTimeout(() => setCopied(null), 1800); };
  const save = async () => { setErr(null); try { await api.saveTemplate(edit!.t, edit!.id); setEdit(null); reload(); } catch (x) { setErr(x); } };
  const groups = Object.entries(REPLY_SITUATIONS).map(([k, label]) => ({ k, label, items: (data ?? []).filter((t) => t.situation === k && (!lang || t.language === lang)) })).filter((g) => g.items.length);
  return (
    <>
      <PageHeader eyebrow="Suggested replies" title="Ready replies in English and Taglish" description="Copy, adjust the blanks (____), paste in Messenger or Facebook. Price questions, visas, delays, complaints, offer follow-ups and after-trip thank-yous."
        actions={can("replies.manage") ? <button className="btn-primary" onClick={() => setEdit({ t: { ...blank } })}><Plus className="h-4 w-4" />Add a reply</button> : undefined} />
      <div className="mb-5 w-48"><Select label="Language" value={lang} onChange={setLang} options={Object.entries(REPLY_LANGUAGES).map(([value, label]) => ({ value, label }))} /></div>
      <ErrorBox error={error} />
      {loading ? <Spinner /> : (
        <div className="grid gap-5 lg:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.k} title={g.label}>
              <ul className="space-y-3">
                {g.items.map((t) => (
                  <li key={t.id} className="rounded-xl border border-ivory-200 bg-ivory-50 p-3">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{t.title}</span><Tag>{REPLY_LANGUAGES[t.language]}</Tag>{!t.is_default && <Tag tone="gold">Edited by {t.updated_by}</Tag>}</div>
                    <p className="mt-1 whitespace-pre-line text-sm text-ink-600">{t.body}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <button className="btn-ghost px-2 py-1 text-xs text-gold-700" onClick={() => copy(t)}>{copied === t.id ? <><Check className="h-3.5 w-3.5" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}</button>
                      {can("replies.manage") && <><button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEdit({ id: t.id, t: { situation: t.situation, language: t.language, title: t.title, body: t.body } })}><Pencil className="h-3.5 w-3.5" />Edit</button>
                        <button className="btn-ghost px-2 py-1 text-xs text-red-800" onClick={() => api.deleteTemplate(t.id).then(reload)}><Trash2 className="h-3.5 w-3.5" />Delete</button></>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit reply" : "Add a reply"}>
        {edit && (
          <div className="space-y-3">
            <Select label="Situation" placeholder={null} value={edit.t.situation} onChange={(v) => setEdit({ ...edit, t: { ...edit.t, situation: v } })} options={Object.entries(REPLY_SITUATIONS).map(([value, label]) => ({ value, label }))} />
            <Select label="Language" placeholder={null} value={edit.t.language} onChange={(v) => setEdit({ ...edit, t: { ...edit.t, language: v as "en" | "tl" } })} options={Object.entries(REPLY_LANGUAGES).map(([value, label]) => ({ value, label }))} />
            <label className="block"><span className="label">Title</span><input className="input" maxLength={120} value={edit.t.title} onChange={(e) => setEdit({ ...edit, t: { ...edit.t, title: e.target.value } })} /></label>
            <label className="block"><span className="label">Message</span><textarea className="input min-h-[140px]" maxLength={2000} value={edit.t.body} onChange={(e) => setEdit({ ...edit, t: { ...edit.t, body: e.target.value } })} /><span className="text-xs text-ink-400">You can use {"{name}"}, {"{range}"}, {"{ref}"} and {"{valid}"}.</span></label>
            <ErrorBox error={err} />
            <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></div>
          </div>
        )}
      </Modal>
    </>
  );
}
