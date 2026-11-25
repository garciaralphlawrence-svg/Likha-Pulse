import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import type { AnalyzeResult } from "../api/types";
import FilterBar, { useFilters } from "../components/FilterBar";
import { Card, ConfidenceBar, ErrorBox, PageHeader, PriorityBadge, SentimentBadge, Spinner, Tag } from "../components/ui";
import { pretty } from "../lib/format";
import { useAsync } from "../lib/useAsync";

const EXAMPLES = [
  "Okay naman ang service pero sobrang tagal ng response.",
  "Wow, excellent service! I waited for five hours.",
  "Ang ganda ng service!",
  "Sobrang bagal ng process.",
  "Pwede po bang magtanong?",
  "Okay sana pero disappointing ang experience.",
  "Nagka-allergic reaction ako after ng drip, namaga braso ko.",
];
const tick = { fontSize: 11, fill: "#64748b" };

export default function Sentiment() {
  const [text, setText] = useState(EXAMPLES[0]);
  const [rating, setRating] = useState("");
  const [res, setRes] = useState<AnalyzeResult | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const { f, set, setF } = useFilters();
  const dist = useAsync(async () => {
    const items: { score: number; confidence: number }[] = [];
    for (let p = 1; p <= 10; p++) {
      const r = await api.feedback(f, p, 200);
      items.push(...r.items);
      if (items.length >= r.total) break;
    }
    const bins = Array.from({ length: 10 }, (_, i) => ({ range: `${-100 + i * 20} to ${-80 + i * 20}`, mid: -90 + i * 20, count: 0 }));
    for (const it of items) bins[Math.min(9, Math.floor((it.score + 100) / 20))].count++;
    const conf = [{ band: "High (≥90%)", count: items.filter((i) => i.confidence >= 0.9).length }, { band: "Moderate (70–89%)", count: items.filter((i) => i.confidence >= 0.7 && i.confidence < 0.9).length }, { band: "Low (<70%) → review", count: items.filter((i) => i.confidence < 0.7).length }];
    return { bins, conf, total: items.length };
  }, [JSON.stringify(f)]);

  const run = async (t = text) => {
    setBusy(true); setErr(null);
    try { setRes(await api.analyze(t, rating ? Number(rating) : null)); } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Sentiment Analysis" description="Test the analysis engine on any English, Filipino or Taglish text, and see how scores and confidence are spread across collected feedback." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Try the engine" subtitle="Nothing typed here is saved.">
          <textarea className="input min-h-[120px] text-[15px]" value={text} onChange={(e) => setText(e.target.value)} aria-label="Text to analyze" />
          <div className="mt-2 flex flex-wrap gap-1.5">{EXAMPLES.map((e) => <button key={e} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50" onClick={() => { setText(e); run(e); }}>{e.length > 38 ? e.slice(0, 38) + "…" : e}</button>)}</div>
          <div className="mt-3 flex items-end gap-2">
            <label className="w-40"><span className="label">Star rating (optional)</span><select className="input" value={rating} onChange={(e) => setRating(e.target.value)}><option value="">None</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            <button className="btn-primary" onClick={() => run()} disabled={busy || !text.trim()}><Sparkles className="h-4 w-4" />{busy ? "Analyzing…" : "Analyze"}</button>
          </div>
          <div className="mt-3"><ErrorBox error={err} /></div>
        </Card>
        <Card title="Result" subtitle={res ? `Engine: ${res.model_version}` : "Run an analysis to see the result"}>
          {!res ? <p className="text-sm text-slate-500">The result shows sentiment, a −100 to +100 score, confidence, emotion, intent, topic, sarcasm check, priority and the reasoning behind each.</p> : (
            <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2.5 text-sm">
              <dt className="text-slate-500">Sentiment</dt><dd className="flex items-center gap-2"><SentimentBadge value={res.sentiment} score={res.score} />{res.possible_sarcasm && <Tag tone="amber">Possible sarcasm</Tag>}</dd>
              <dt className="text-slate-500">Confidence</dt><dd><ConfidenceBar value={res.confidence} /> <span className="text-xs text-slate-500">{res.confidence_band}</span></dd>
              <dt className="text-slate-500">Emotion</dt><dd>{pretty(res.emotion)}</dd>
              <dt className="text-slate-500">Intent</dt><dd>{pretty(res.intent)} <span className="text-xs text-slate-500">— {res.intent_reason}</span></dd>
              <dt className="text-slate-500">Topic</dt><dd>{res.topics.join(", ")}</dd>
              <dt className="text-slate-500">Language</dt><dd>{pretty(res.language)}</dd>
              <dt className="text-slate-500">Why</dt><dd className="leading-relaxed">{res.reason}</dd>
              <dt className="text-slate-500">Priority</dt><dd><PriorityBadge value={res.priority} /> <span className="text-xs text-slate-600">{res.priority_reason}</span></dd>
              <dt className="text-slate-500">Recommended action</dt><dd>{res.recommended_action}</dd>
            </dl>
          )}
        </Card>
      </div>
      <h2 className="mb-3 mt-8 text-base font-semibold">Across collected feedback</h2>
      <FilterBar f={f} set={set} setF={setF} fields={["platform"]} />
      {dist.loading && !dist.data ? <Spinner /> : dist.data && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Sentiment score distribution" subtitle={`${dist.data.total} items · negative ≤ −25, positive ≥ +25 by default (configurable)`}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dist.data.bins}><CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" /><XAxis dataKey="mid" tick={tick} tickFormatter={(v) => (v > 0 ? `+${v}` : `${v}`)} /><YAxis tick={tick} allowDecimals={false} /><Tooltip labelFormatter={(_, p) => `Score ${p?.[0]?.payload?.range ?? ""}`} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>{dist.data.bins.map((b) => <Cell key={b.mid} fill={b.mid <= -25 ? "#d64545" : b.mid >= 25 ? "#1f9d6b" : "#8a94a6"} />)}</Bar></BarChart>
            </ResponsiveContainer>
          </Card>
          <Card title="AI confidence bands" subtitle="Confidence is how sure the engine is, separate from sentiment strength">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dist.data.conf}><CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" /><XAxis dataKey="band" tick={tick} /><YAxis tick={tick} allowDecimals={false} /><Tooltip />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>{dist.data.conf.map((c, i) => <Cell key={c.band} fill={["#1f9d6b", "#d4a017", "#d64545"][i]} />)}</Bar></BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
    </>
  );
}
