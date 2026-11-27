import { Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import type { AnalyzeResult } from "../api/types";
import { plainReason } from "../components/FeedbackDrawer";
import { ErrorBox, PageHeader, PriorityBadge } from "../components/ui";
import { FEELING, MOOD, PURPOSE, SENT_COLORS, headline, label, sureness } from "../lib/format";

const EXAMPLES = [
  "Okay naman ang tour pero sobrang tagal ng reply sa inquiry.",
  "Wow, excellent service! We waited five hours for our van.",
  "Ang saya ng Boracay trip namin! Super accommodating ng tour guide.",
  "Pwede po bang magtanong kung magkano ang Japan tour?",
  "Naiwan po kami ng bangka sa island hopping, stranded kami dito.",
  "Follow up lang po sa refund ng cancelled tour ko, wala pa rin hanggang ngayon.",
];

export default function Sentiment() {
  const [text, setText] = useState("");
  const [res, setRes] = useState<AnalyzeResult | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const run = async (t = text) => {
    if (!t.trim()) return;
    setBusy(true); setErr(null);
    try { setRes(await api.analyze(t)); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const view = res ? { emotion: res.emotion, intent: res.intent, topic: res.topics[0] ?? "General", sentiment: res.sentiment } : null;

  return (
    <>
      <PageHeader eyebrow="Ask the AI" title="What is this customer really saying?" description="Paste any Facebook comment or Messenger chat — English, Tagalog or Taglish. Nothing you type here is saved." />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="card p-6">
          <textarea className="input min-h-[170px] resize-none rounded-2xl text-[17px] leading-relaxed" placeholder="e.g. Okay naman ang tour pero sobrang tagal ng sundo sa airport…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Message to review" />
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-ink-400">Or try one of these:</p>
            <button className="btn-gold" onClick={() => run()} disabled={busy || !text.trim()}><Wand2 className="h-4 w-4" />{busy ? "Reading…" : "Review this message"}</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((e) => <button key={e} className="rounded-full border border-ivory-300 bg-ivory-50 px-3 py-1.5 text-left text-xs text-ink-600 transition hover:border-gold-300 hover:bg-gold-50" onClick={() => { setText(e); run(e); }}>{e}</button>)}
          </div>
          <div className="mt-4"><ErrorBox error={err} /></div>
        </div>

        <section className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 text-ivory-100 shadow-lift">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-500/15 blur-3xl" />
          <p className="relative flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-gold-300"><Sparkles className="h-3.5 w-3.5" />AI Review</p>
          {!res || !view ? (
            <p className="relative mt-4 font-display text-2xl leading-snug text-ivory-200/80">Your review will appear here: how the customer feels, what it's about, how urgent it is, and what you should do.</p>
          ) : (
            <div className="relative" key={res.reason + res.score}>
              <p className="mt-2 font-display text-[30px] leading-tight text-ivory-50">{headline(view)}</p>
              <dl className="stagger mt-5 divide-y divide-white/[0.06] border-t border-white/[0.06] text-[15px]">
                {[
                  ["Mood", <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: SENT_COLORS[res.sentiment] }} />{label(MOOD, res.sentiment)} · {label(FEELING, res.emotion)}</span>],
                  ["Type", label(PURPOSE, res.intent)],
                  ["About", res.topics[0] === "General" ? "General experience" : res.topics.join(", ")],
                  ["Urgency", <><span className="mr-2"><PriorityBadge value={res.priority} /></span><span className="text-sm text-ivory-200/80">{res.priority_reason}</span></>],
                  ["Why", plainReason({ reason: res.reason, possible_sarcasm: res.possible_sarcasm, sentiment: res.sentiment })],
                ].map(([k, v], i) => <div key={i} className="grid grid-cols-[110px_1fr] gap-3 py-2.5"><dt className="text-[11px] uppercase tracking-[0.16em] text-gold-300/80">{k}</dt><dd>{v}</dd></div>)}
              </dl>
              <div className="mt-5 rounded-2xl border border-gold-300/30 bg-gold-500/10 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-gold-300">Suggested next step</p>
                <p className="mt-1 leading-relaxed text-ivory-50">{res.recommended_action}</p>
              </div>
              <p className="mt-4 text-xs text-ivory-200/60">{sureness(res.confidence)}{res.possible_sarcasm && " · might be sarcastic"}</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
