import { Check, CheckCircle2, ExternalLink, PenLine, Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { FeedbackDetail } from "../api/types";
import { EMOTIONS, INTENTS } from "../demo/engine";
import { useAuth } from "../lib/auth";
import { FEELING, MOOD, PLATFORM_LABEL, PURPOSE, SENT_COLORS, URGENCY, fmtDate, headline, label, sureness } from "../lib/format";
import { Drawer, ErrorBox, PriorityBadge, SampleTag, Select, Spinner, Tag } from "./ui";

/** Turns the engine's explanation into a sentence a manager can read in two seconds. */
export function plainReason(fb: { reason: string; possible_sarcasm: boolean; sentiment: string }): string {
  if (fb.possible_sarcasm) return "The words sound positive, but the experience described is bad, so this is most likely sarcasm.";
  const words = Array.from(fb.reason.matchAll(/'([^']+)'/g)).map((m) => m[1]);
  const contrast = /changes direction at '([^']+)'/.exec(fb.reason);
  if (contrast) return `The customer starts politely, but what comes after “${contrast[1]}” is what really matters, and it is ${label(MOOD, fb.sentiment).toLowerCase()}.`;
  const key = [...new Set(words)].slice(0, 3).map((w) => `“${w}”`).join(", ");
  if (!key) return "There are no strong positive or negative words, so it reads as a neutral message.";
  return `Words like ${key} show the customer is ${label(MOOD, fb.sentiment).toLowerCase()}.`;
}

function Line({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[140px_1fr] gap-3 py-2.5"><span className="text-[11px] uppercase tracking-[0.16em] text-gold-300/80">{k}</span><div className="text-[15px] text-ivory-100">{children}</div></div>;
}

export default function FeedbackDrawer({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged?: () => void }) {
  const { can } = useAuth();
  const [fb, setFb] = useState<FeedbackDetail | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [edit, setEdit] = useState({ sentiment: "", emotion: "", intent: "", priority: "", note: "" });

  useEffect(() => {
    setFb(null); setErr(null); setFixing(false);
    if (id) api.feedbackDetail(id).then((d) => { setFb(d); setEdit({ sentiment: d.sentiment, emotion: d.emotion, intent: d.intent, priority: d.priority, note: "" }); }).catch(setErr);
  }, [id]);

  const act = async (fn: () => Promise<FeedbackDetail>) => {
    setBusy(true); setErr(null);
    try { const d = await fn(); setFb(d); setFixing(false); setEdit({ sentiment: d.sentiment, emotion: d.emotion, intent: d.intent, priority: d.priority, note: "" }); onChanged?.(); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const corrections = fb ? Object.fromEntries((["sentiment", "emotion", "intent", "priority"] as const).filter((k) => edit[k] && edit[k] !== fb[k]).map((k) => [k, edit[k]])) : {};

  return (
    <Drawer open={!!id} onClose={onClose} title="Message review">
      <ErrorBox error={err} />
      {!fb ? (!err && <Spinner />) : (
        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
              <span className="font-medium text-ink-700">{PLATFORM_LABEL[fb.platform] ?? fb.platform_name}</span><span>·</span><span>{fmtDate(fb.created_at)}</span>
              {fb.rating && <span className="flex text-gold-500">{Array.from({ length: Math.round(fb.rating) }, (_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}</span>}
              {fb.is_sample && <SampleTag />}
            </div>
            <blockquote style={{ animation: "fadeUp .7s cubic-bezier(.2,.7,.2,1) both" }} className="mt-3 font-display text-[26px] leading-snug text-ink-900">“{fb.content}”</blockquote>
          </div>

          <section className="relative overflow-hidden rounded-3xl bg-ink-950 p-6 text-ivory-100 shadow-lift">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold-500/15 blur-3xl" />
            <p className="relative flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-gold-300"><Sparkles className="h-3.5 w-3.5" />AI Review</p>
            <p className="relative mt-2 font-display text-[28px] leading-tight text-ivory-50">{headline(fb)}</p>
            <div className="stagger relative mt-4 divide-y divide-white/[0.06] border-t border-white/[0.06]">
              <Line k="Mood"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: SENT_COLORS[fb.sentiment] }} />{label(MOOD, fb.sentiment)} · {label(FEELING, fb.emotion)}</span></Line>
              <Line k="Type">{label(PURPOSE, fb.intent)}</Line>
              <Line k="About">{fb.topic === "General" ? "General experience" : fb.topic}</Line>
              <Line k="Urgency"><span className="mr-2 inline-block"><PriorityBadge value={fb.priority} /></span><span className="text-sm text-ivory-200/80">{fb.priority_reason}</span></Line>
              <Line k="Why">{plainReason(fb)}</Line>
            </div>
            <div className="relative mt-5 rounded-2xl border border-gold-300/30 bg-gold-500/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gold-300">Suggested next step</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ivory-50">{fb.recommended_action}</p>
            </div>
            <div className="relative mt-4 flex flex-wrap items-center gap-2 text-xs text-ivory-200/70">
              <span>{sureness(fb.confidence)}</span>
              {fb.possible_sarcasm && <span className="rounded-full bg-gold-500/20 px-2 py-0.5 text-gold-300">Might be sarcastic</span>}
              {fb.review_status === "reviewed" && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">Checked by your team</span>}
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            {can("feedback.manage") && (fb.action_status === "resolved"
              ? <button className="btn-secondary" disabled={busy} onClick={() => act(() => api.setStatus(fb.id, "open"))}>Reopen</button>
              : <button className="btn-primary" disabled={busy} onClick={() => act(() => api.setStatus(fb.id, "resolved"))}><Check className="h-4 w-4" />Mark as done</button>)}
            {can("feedback.review") && <>
              <button className="btn-secondary" disabled={busy} onClick={() => act(() => api.review(fb.id, { note: "AI result confirmed" }))}><CheckCircle2 className="h-4 w-4" />The AI is right</button>
              <button className="btn-secondary" onClick={() => setFixing(!fixing)}><PenLine className="h-4 w-4" />Correct the AI</button>
            </>}
            {fb.source_url && <a className="btn-ghost" href={fb.source_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Open original</a>}
          </div>

          {fixing && (
            <section className="card p-5">
              <p className="font-display text-xl font-semibold">What should it be?</p>
              <p className="mb-4 text-sm text-ink-400">Your correction is saved with your name. The AI's original answer is kept for reference.</p>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Mood" placeholder={null} value={edit.sentiment} onChange={(v) => setEdit({ ...edit, sentiment: v })} options={["positive", "neutral", "negative"].map((v) => ({ value: v, label: MOOD[v] }))} />
                <Select label="Urgency" placeholder={null} value={edit.priority} onChange={(v) => setEdit({ ...edit, priority: v })} options={["critical", "high", "medium", "low"].map((v) => ({ value: v, label: URGENCY[v] }))} />
                <Select label="Feeling" placeholder={null} value={edit.emotion} onChange={(v) => setEdit({ ...edit, emotion: v })} options={EMOTIONS.map((v) => ({ value: v, label: FEELING[v] }))} />
                <Select label="Type" placeholder={null} value={edit.intent} onChange={(v) => setEdit({ ...edit, intent: v })} options={INTENTS.map((v) => ({ value: v, label: PURPOSE[v] }))} />
              </div>
              <label className="mt-3 block"><span className="label">Note (optional)</span><input className="input" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} placeholder="e.g. This is sarcasm" /></label>
              <button className="btn-gold mt-4" disabled={busy || !Object.keys(corrections).length} onClick={() => act(() => api.review(fb.id, { ...corrections, note: edit.note }))}>Save correction</button>
            </section>
          )}

          {fb.reviews.length > 0 && (
            <section>
              <p className="eyebrow mb-2">History</p>
              <ul className="space-y-2">
                {fb.reviews.map((r, i) => (
                  <li key={i} className="rounded-xl bg-white px-4 py-2.5 text-sm ring-1 ring-ivory-200">
                    <span className="font-medium">{r.reviewer}</span>{" "}
                    {r.field === "confirm" ? "confirmed the AI was right" : <>changed {r.field === "sentiment" ? "mood" : r.field === "intent" ? "type" : r.field === "priority" ? "urgency" : "feeling"} to <b>{label({ ...MOOD, ...URGENCY, ...FEELING, ...PURPOSE }, r.corrected)}</b></>}
                    <span className="text-xs text-ink-400"> · {fmtDate(r.at)}</span>{r.note && r.note !== "AI result confirmed" && <p className="text-xs text-ink-500">“{r.note}”</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {fb.action_status === "resolved" && <Tag tone="green">Marked as done</Tag>}
        </div>
      )}
    </Drawer>
  );
}
