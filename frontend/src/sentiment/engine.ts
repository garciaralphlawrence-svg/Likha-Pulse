// TypeScript port of backend/app/sentiment/rule_engine.py (customer sentiment, runs in the browser).
// Keep in sync with the Python version; `npm run test:engine` checks the shared cases.
import LEX from "./lexicon.json";

type Lex = typeof LEX & { positive: Record<string, number>; negative: Record<string, number>; intensifiers: Record<string, number>;
  emotions: Record<string, string[]>; intents: Record<string, string[]>; topics: Record<string, string[]> };
const L = LEX as Lex;
export const ENGINE_VERSION = `rule-engine-1.0 (lexicon ${L.version})`;

export interface Signal { term: string; weight: number; note: string }
export interface Analysis {
  label: "positive" | "negative" | "neutral"; score: number; confidence: number; emotion: string; emotion_scores: Record<string, number>;
  intent: string; intent_reason: string; topics: string[]; primary_topic: string; possible_sarcasm: boolean; reason: string;
  priority: string; priority_reason: string; recommended_action: string; language: string; engine: string; model_version: string;
}
export interface Thresholds { negative_max: number; positive_min: number }

const TIME_RE = /\b(\d+|one|two|three|four|five|six|isang|dalawang|tatlong)\s*(hours?|hrs?|oras|minutes?|mins?|days?|araw|weeks?|linggo)\b/g;

export function normalize(text: string): string {
  let t = text.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  t = t.replace(/https?:\/\/\S+/g, " ").replace(/'/g, "");
  t = t.replace(/[^a-z0-9ñ?!\s-]/g, " ").replace(/-/g, " ");
  return t.replace(/\s+/g, " ").trim();
}

function findAll(padded: string, term: string): number[] {
  const out: number[] = []; const needle = ` ${term} `; let i = 0;
  for (;;) { i = padded.indexOf(needle, i); if (i < 0) return out; out.push(i + 1); i += 1; }
}
const contains = (padded: string, term: string) => padded.includes(` ${term} `);
const hits = (padded: string, words: string[]) => words.filter((w) => contains(padded, w));

export function detectLanguage(norm: string): string {
  const fil = new Set(["ang", "ng", "po", "naman", "pero", "sobrang", "hindi", "di", "ba", "mga", "sa", "na", "ko", "ako", "kayo", "nyo", "lang", "talaga", "sana", "kasi"]);
  const en = new Set(["the", "is", "and", "but", "very", "not", "was", "i", "you", "it", "to", "for", "my", "service", "please"]);
  const words = norm.replace(/[?!]/g, " ").split(" ").filter(Boolean);
  const f = words.filter((w) => fil.has(w)).length, e = words.filter((w) => en.has(w)).length;
  return f && e ? "taglish" : f ? "filipino" : e ? "english" : "unknown";
}

function scoreTerms(norm: string, contrastAt: number | null): Signal[] {
  const padded = ` ${norm.replace(/[?!]/g, " ")} `;
  const terms: [string, number][] = [...Object.entries(L.positive), ...Object.entries(L.negative)];
  terms.sort((a, b) => b[0].length - a[0].length);
  const negators = new Set(L.negators);
  const matches: [number, number, string, number][] = [];
  for (const [term, weight] of terms) {
    if (weight === 0) continue;
    for (const start of findAll(padded, term)) {
      const end = start + term.length;
      if (matches.some(([s, e]) => s < end && start < e)) continue;
      matches.push([start, end, term, weight]);
    }
  }
  matches.sort((a, b) => a[0] - b[0]);
  const signals: Signal[] = []; let prevEnd = 0;
  for (const [start, end, term, weight] of matches) {
    const before = padded.slice(prevEnd, start).split(" ").filter(Boolean).slice(-3);
    prevEnd = end;
    let w = weight; const notes: string[] = [];
    const selfNeg = ["wala", "walang", "hindi", "di ", "no ", "not ", "never"].some((p) => term.startsWith(p));
    if (before.some((b) => negators.has(b)) && !selfNeg) { w = -w * 0.8; notes.push("negated"); }
    const mult = Math.max(1, ...before.slice(-2).map((b) => L.intensifiers[b] ?? 1));
    if (mult > 1) { w *= mult; notes.push("intensified"); }
    if (contrastAt !== null) {
      if (start < contrastAt) { w *= 0.4; notes.push("before contrast"); } else { w *= 1.4; notes.push("after contrast"); }
    }
    signals.push({ term, weight: Math.round(w * 100) / 100, note: notes.join(", ") });
  }
  return signals;
}

function contrastPosition(norm: string): [number | null, string | null] {
  const padded = ` ${norm} `; let best: number | null = null, word: string | null = null;
  for (const c of L.contrast) for (const pos of findAll(padded, c)) if (pos > 2 && (best === null || pos > best)) { best = pos; word = c; }
  return [best, word];
}

export function analyze(text: string, rating: number | null = null, th: Thresholds = { negative_max: -25, positive_min: 25 }): Analysis {
  const norm = normalize(text);
  const padded = ` ${norm.replace(/\?/g, " ? ").replace(/!/g, " ! ")} `;
  const [contrastAt, contrastWord] = contrastPosition(norm);
  const signals = scoreTerms(norm, contrastAt);
  let raw = signals.reduce((s, x) => s + x.weight, 0);
  if (text.includes("!") && raw) raw *= 1.1;

  const praise = hits(padded, L.sarcasm_praise);
  const negMarkers = [...hits(padded, L.sarcasm_negative_markers), ...Array.from(norm.matchAll(TIME_RE)).map((m) => m[0])];
  const sarcasm = praise.length > 0 && negMarkers.length > 0 && raw > -1.5;

  let score = 100 * Math.tanh(raw / 4);
  if (rating !== null && rating !== undefined) {
    const rs = ((rating - 3) / 2) * 80;
    score = signals.length ? 0.5 * score + 0.5 * rs : rs;
  }
  if (sarcasm) score = Math.min(-40, -Math.abs(score));
  const scoreI = Math.round(Math.max(-100, Math.min(100, score)));
  const label = scoreI <= th.negative_max ? "negative" : scoreI >= th.positive_min ? "positive" : "neutral";

  const emoClause = contrastAt !== null ? ` ${norm.slice(contrastAt)} ` : padded;
  const emo: Record<string, number> = {};
  for (const [e, words] of Object.entries(L.emotions)) emo[e] = hits(padded, words).length + (contrastAt !== null ? hits(emoClause, words).length : 0);
  if (sarcasm) emo.frustration += 2;
  if (text.includes("?") && ["paano", "bakit", "how", "why"].some((w) => contains(padded, w))) emo.confusion += 1;
  const negE = ["anger", "frustration", "disappointment", "sadness", "concern"], posE = ["happiness", "satisfaction", "appreciation", "excitement"];
  const pool = label === "negative" ? [...negE, "confusion"] : label === "positive" ? posE : Object.keys(emo);
  const argmax = (keys: string[]) => keys.reduce((a, b) => ((emo[b] ?? 0) > (emo[a] ?? 0) ? b : a), keys[0]);
  let best = argmax(pool);
  if ((emo[best] ?? 0) === 0) best = argmax(Object.keys(emo));
  if ((emo[best] ?? 0) === 0) best = label === "positive" ? "satisfaction" : label === "negative" ? "disappointment" : "neutral";
  else if (label === "positive" && ["frustration", "anger", "disappointment", "sadness"].includes(best) && !sarcasm) best = "satisfaction";
  else if (label === "negative" && posE.includes(best)) best = sarcasm || negMarkers.length ? "frustration" : "disappointment";

  const ih: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(L.intents)) ih[k] = hits(padded, v);
  const firstWord = norm.split(" ")[0] ?? "";
  const isQuestion = text.includes("?") || (L.question_starters.includes(firstWord) && norm.split(" ").length <= 12);
  let intent: string, why: string;
  if (ih.follow_up_request.length) [intent, why] = ["follow_up_request", `asks for an update ('${ih.follow_up_request[0]}')`];
  else if (ih.request_assistance.length) [intent, why] = ["request_assistance", `asks for help ('${ih.request_assistance[0]}')`];
  else if (ih.reported_problem.length) [intent, why] = ["reported_problem", `reports a problem ('${ih.reported_problem[0]}')`];
  else if (label === "negative") [intent, why] = ["complaint", "expresses dissatisfaction"];
  else if (isQuestion || (ih.inquiry.length && label === "neutral")) [intent, why] = ["inquiry", "asks a question" + (ih.inquiry.length ? ` ('${ih.inquiry[0]}')` : "")];
  else if (ih.suggestion.length) [intent, why] = ["suggestion", `proposes an improvement ('${ih.suggestion[0]}')`];
  else if (label === "positive" && ih.appreciation.length) [intent, why] = ["appreciation", `thanks the business ('${ih.appreciation[0]}')`];
  else if (label === "positive") [intent, why] = ["compliment", "praises the service"];
  else [intent, why] = ["general_feedback", "shares an opinion without a request"];

  const th2: Record<string, number> = {};
  const main = contrastAt !== null ? ` ${norm.slice(contrastAt)} ` : padded;
  for (const [topic, words] of Object.entries(L.topics)) {
    const n = hits(padded, words).length;
    if (n) th2[topic] = n + 2 * hits(main, words).length;
  }
  if (th2["Safety & Health"]) th2["Safety & Health"] += 10; // a health or safety mention always leads
  const sortedTopics = Object.keys(th2).sort((a, b) => th2[b] - th2[a]);
  const topics = sortedTopics.length ? sortedTopics : ["General"];

  const signs = new Set(signals.map((s) => (s.weight > 0 ? 1 : -1)));
  let conf = 0.55 + Math.min(0.3, 0.06 * signals.length);
  if (signs.size === 1) conf += 0.08; else if (signs.size > 1 && contrastAt === null) conf -= 0.18;
  if (rating !== null && rating !== undefined) conf += 0.07;
  if (!signals.length) conf = intent === "inquiry" ? 0.72 : 0.5;
  if (sarcasm) conf = Math.min(conf, 0.6);
  conf = Math.round(Math.max(0.3, Math.min(0.97, conf)) * 100) / 100;

  const a: Analysis = {
    label, score: scoreI, confidence: conf, emotion: best, emotion_scores: emo, intent, intent_reason: `The message ${why}.`,
    topics: topics.slice(0, 3), primary_topic: topics[0], possible_sarcasm: sarcasm,
    reason: explain(label, scoreI, signals, contrastWord, sarcasm, praise, negMarkers, rating),
    priority: "low", priority_reason: "", recommended_action: "", language: detectLanguage(norm), engine: "rule", model_version: ENGINE_VERSION,
  };
  return a;
}

function explain(label: string, score: number, signals: Signal[], contrastWord: string | null, sarcasm: boolean, praise: string[], neg: string[], rating: number | null): string {
  if (sarcasm) return `Possible sarcasm: positive wording (${praise.slice(0, 2).map((p) => `'${p}'`).join(", ")}) contradicts a negative experience (${neg.slice(0, 2).map((m) => `'${m}'`).join(", ")}). Treated as negative and sent for manual review.`;
  if (!signals.length) return "No clear positive or negative wording was found, so the message is treated as neutral." + (rating ? ` The ${rating}-star rating was used.` : "");
  const pos = signals.filter((s) => s.weight > 0), negs = signals.filter((s) => s.weight < 0);
  const fmt = (items: Signal[]) => [...items].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 3).map((s) => `'${s.term}'` + (s.note ? ` (${s.note})` : "")).join(", ");
  const parts: string[] = [];
  if (contrastWord && pos.length && negs.length) {
    const after = signals.filter((s) => s.note.includes("after contrast")).reduce((t, s) => t + s.weight, 0);
    parts.push(`The message changes direction at '${contrastWord}'; the part after it is ${after < 0 ? "negative" : "positive"} and carries more weight.`);
  }
  if (negs.length) parts.push(`Negative cues: ${fmt(negs)}.`);
  if (pos.length) parts.push(`Positive cues: ${fmt(pos)}.`);
  if (rating) parts.push(`Star rating ${rating}/5 was combined with the text.`);
  parts.push(`Overall score ${score >= 0 ? "+" : ""}${score} → ${label}.`);
  return parts.join(" ");
}

export function assessPriority(a: Analysis, text: string, repeated = 0): [string, string] {
  const padded = ` ${normalize(text)} `;
  const critical = hits(padded, L.critical_terms);
  if (critical.length) return ["critical", `Mentions a health, safety or serious issue ('${critical[0]}'). Handle this today.`];
  if (a.score <= -80) return ["high", "The customer is very upset."];
  if (repeated >= 3 && a.label === "negative") return ["high", `${repeated} customers complained about ${a.primary_topic.toLowerCase()} this week.`];
  if (a.intent === "follow_up_request") return ["high", "The customer is still waiting for a reply."];
  if (["reported_problem", "request_assistance"].includes(a.intent)) return ["medium", "Reports a problem or asks for help. Reply soon."];
  if (a.label === "negative") return ["medium", "A complaint worth answering."];
  if (a.intent === "suggestion") return ["medium", "A suggestion worth considering."];
  if (a.possible_sarcasm) return ["medium", "Might be sarcasm. Check what they really mean."];
  return ["low", "Nothing urgent."];
}

const ACTIONS: Record<string, string> = {
  critical: "Escalate to the manager on duty today, contact the customer privately, and document the case.",
  follow_up_request: "Reply with a concrete status update and a timeline; close the loop once resolved.",
  request_assistance: "Assign a staff member to assist and confirm the next step with the customer.",
  reported_problem: "Log the problem, investigate the cause, and tell the customer when it is fixed.",
  complaint: "Acknowledge the concern, apologize where appropriate, and review the process involved.",
  inquiry: "Answer the question; consider adding it to the FAQ if it comes up often.",
  suggestion: "Thank the customer and forward the suggestion to the team for evaluation.",
  compliment: "Thank the customer publicly and share the praise with the staff involved.",
  appreciation: "Thank the customer and share the feedback with the team.",
  general_feedback: "Thank them for the feedback. No action needed.",
};
export const recommend = (a: Analysis) => (a.priority === "critical" ? ACTIONS.critical : ACTIONS[a.intent] ?? ACTIONS.general_feedback);

export function fullAnalysis(text: string, rating: number | null, th: Thresholds, repeated = 0): Analysis {
  const a = analyze(text, rating, th);
  [a.priority, a.priority_reason] = assessPriority(a, text, repeated);
  a.recommended_action = recommend(a);
  return a;
}
export const EMOTIONS = ["happiness", "satisfaction", "appreciation", "anger", "frustration", "disappointment", "sadness", "confusion", "concern", "excitement", "neutral"];
export const INTENTS = ["complaint", "compliment", "inquiry", "suggestion", "request_assistance", "general_feedback", "reported_problem", "appreciation", "follow_up_request"];
export const TOPICS = [...Object.keys(L.topics), "General"];
