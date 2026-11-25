import { CheckCircle2, ExternalLink, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { FeedbackDetail } from "../api/types";
import { EMOTIONS, INTENTS } from "../demo/engine";
import { useAuth } from "../lib/auth";
import { fmtDate, pretty } from "../lib/format";
import { ConfidenceBar, Drawer, ErrorBox, PriorityBadge, SampleTag, Select, SentimentBadge, Spinner, Tag } from "./ui";

function Row({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[28px_150px_1fr] gap-2 border-b border-slate-100 py-2.5 text-sm">
      <span className="text-xs font-semibold text-slate-400">{n}</span><span className="text-slate-500">{label}</span><div className="min-w-0 text-slate-800">{children}</div>
    </div>
  );
}

export default function FeedbackDrawer({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged?: () => void }) {
  const { can } = useAuth();
  const [fb, setFb] = useState<FeedbackDetail | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState({ sentiment: "", emotion: "", intent: "", priority: "", note: "", use_for_evaluation: false });

  useEffect(() => {
    setFb(null); setErr(null);
    if (id) api.feedbackDetail(id).then((d) => { setFb(d); setEdit({ sentiment: d.sentiment, emotion: d.emotion, intent: d.intent, priority: d.priority, note: "", use_for_evaluation: false }); }).catch(setErr);
  }, [id]);

  const act = async (fn: () => Promise<FeedbackDetail>) => {
    setBusy(true); setErr(null);
    try { const d = await fn(); setFb(d); setEdit((e) => ({ ...e, sentiment: d.sentiment, emotion: d.emotion, intent: d.intent, priority: d.priority, note: "" })); onChanged?.(); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const corrections = fb ? Object.fromEntries((["sentiment", "emotion", "intent", "priority"] as const).filter((k) => edit[k] && edit[k] !== fb[k]).map((k) => [k, edit[k]])) : {};

  return (
    <Drawer open={!!id} onClose={onClose} title="Feedback analysis">
      <ErrorBox error={err} />
      {!fb ? (!err && <Spinner />) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Tag tone="blue">{fb.platform_name}</Tag><span>{fmtDate(fb.created_at)}</span><span>· {fb.author}</span>
            {fb.rating && <span>· {"★".repeat(Math.round(fb.rating))}{"☆".repeat(5 - Math.round(fb.rating))}</span>}
            {fb.is_sample && <SampleTag />}<Tag>{pretty(fb.language)}</Tag>
            <Tag tone={fb.review_status === "reviewed" ? "green" : fb.review_status === "pending_review" ? "amber" : "slate"}>{pretty(fb.review_status)}</Tag>
          </div>

          <div>
            <Row n={1} label="Original feedback"><blockquote className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[15px] leading-relaxed">{fb.content}</blockquote></Row>
            <Row n={2} label="AI sentiment prediction">
              <div className="flex flex-wrap items-center gap-2"><SentimentBadge value={fb.ai.sentiment} />
                {fb.sentiment !== fb.ai.sentiment && <span className="text-xs">→ corrected to <SentimentBadge value={fb.sentiment} /></span>}
                {fb.possible_sarcasm && <Tag tone="amber">Possible sarcasm</Tag>}</div>
            </Row>
            <Row n={3} label="Sentiment score"><span className="font-semibold tabular-nums">{fb.score > 0 ? `+${fb.score}` : fb.score}</span><span className="text-slate-500"> on a −100 to +100 scale (direction and strength)</span></Row>
            <Row n={4} label="Confidence score"><ConfidenceBar value={fb.confidence} /><p className="mt-1 text-xs text-slate-500">How sure the engine is. It is not a guarantee of correctness.</p></Row>
            <Row n={5} label="Detected emotion">{pretty(fb.emotion)}{fb.emotion !== fb.ai.emotion && <span className="text-xs text-slate-500"> (AI: {pretty(fb.ai.emotion)})</span>}</Row>
            <Row n={6} label="Identified intent">{pretty(fb.intent)}{fb.intent !== fb.ai.intent && <span className="text-xs text-slate-500"> (AI: {pretty(fb.ai.intent)})</span>}<p className="text-xs text-slate-500">{fb.intent_reason}</p></Row>
            <Row n={7} label="Main topic"><span className="font-medium">{fb.topic}</span>{fb.topics.length > 1 && <span className="text-xs text-slate-500"> · also {fb.topics.slice(1).join(", ")}</span>}</Row>
            <Row n={8} label="Reason for classification"><p className="leading-relaxed">{fb.reason}</p></Row>
            <Row n={9} label="Priority level"><div className="flex items-center gap-2"><PriorityBadge value={fb.priority} />{fb.priority !== fb.ai.priority && <span className="text-xs text-slate-500">(AI: {fb.ai.priority})</span>}</div><p className="mt-1 text-xs text-slate-600">{fb.priority_reason}</p></Row>
            <Row n={10} label="Recommended action"><p className="rounded-lg bg-navy-50 p-2.5 leading-relaxed text-navy-900">{fb.recommended_action}</p></Row>
          </div>

          <div className="flex flex-wrap gap-2">
            {fb.source_url ? <a className="btn-secondary" href={fb.source_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Open original source</a>
              : <span className="text-xs text-slate-500">No authorized source link is available for this item.</span>}
            {can("feedback.manage") && (
              <>
                <Select value={fb.action_status} placeholder={null} onChange={(v) => act(() => api.setStatus(fb.id, v))}
                  options={[{ value: "open", label: "Status: Open" }, { value: "pending_action", label: "Status: Pending action" }, { value: "resolved", label: "Status: Resolved" }]} />
                <button className="btn-ghost" disabled={busy} onClick={() => act(() => api.reanalyze(fb.id))}><RotateCcw className="h-4 w-4" />Re-run analysis</button>
              </>
            )}
          </div>

          {can("feedback.review") && (
            <section className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold">Human validation</h3>
              <p className="mb-3 text-xs text-slate-500">Correct anything the AI got wrong. The original prediction is kept; your correction, name and time are recorded in the audit history.</p>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Sentiment" placeholder={null} value={edit.sentiment} onChange={(v) => setEdit({ ...edit, sentiment: v })} options={["positive", "neutral", "negative"]} />
                <Select label="Priority" placeholder={null} value={edit.priority} onChange={(v) => setEdit({ ...edit, priority: v })} options={["critical", "high", "medium", "low"]} />
                <Select label="Emotion" placeholder={null} value={edit.emotion} onChange={(v) => setEdit({ ...edit, emotion: v })} options={EMOTIONS} />
                <Select label="Intent" placeholder={null} value={edit.intent} onChange={(v) => setEdit({ ...edit, intent: v })} options={INTENTS} />
              </div>
              <label className="mt-3 block"><span className="label">Note (optional)</span><input className="input" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} placeholder="Why the correction was made" /></label>
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={edit.use_for_evaluation} onChange={(e) => setEdit({ ...edit, use_for_evaluation: e.target.checked })} />Mark as approved for model evaluation data</label>
              <div className="mt-3 flex gap-2">
                <button className="btn-primary" disabled={busy || !Object.keys(corrections).length} onClick={() => act(() => api.review(fb.id, { ...corrections, note: edit.note, use_for_evaluation: edit.use_for_evaluation }))}>Save correction</button>
                <button className="btn-secondary" disabled={busy} onClick={() => act(() => api.review(fb.id, { note: edit.note || "AI result confirmed", use_for_evaluation: edit.use_for_evaluation }))}><CheckCircle2 className="h-4 w-4" />Confirm AI result</button>
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold">Review history</h3>
            {fb.reviews.length === 0 ? <p className="text-sm text-slate-500">Not reviewed yet.</p> : (
              <ul className="space-y-2">
                {fb.reviews.map((r, i) => (
                  <li key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-medium">{r.reviewer}</span>{" "}
                    {r.field === "confirm" ? "confirmed the AI result" : <>changed {r.field}: <s className="text-slate-400">{pretty(r.original)}</s> → <b>{pretty(r.corrected)}</b></>}
                    <span className="text-xs text-slate-500"> · {fmtDate(r.at)}</span>{r.note && <p className="text-xs text-slate-600">“{r.note}”</p>}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-slate-400">Engine: {fb.model_version} · analyzed {fmtDate(fb.analyzed_at)}{fb.external_id && ` · source ID ${fb.external_id}`}</p>
          </section>
        </div>
      )}
    </Drawer>
  );
}
