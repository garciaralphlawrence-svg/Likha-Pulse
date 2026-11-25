// In-browser implementation of the API for the public demo (GitHub Pages).
// Everything is stored in this browser's localStorage. All feedback is labeled SAMPLE data.
// The analysis uses the same rule engine as the server (engine.ts is a port of rule_engine.py).
import type { Api, AuditRow, Dashboard, FeedbackDetail, FeedbackItem, Filters, Insight, InsightSummary, Me, Notice, ReportRow, SettingsData, UserRow } from "../api/types";
import { fullAnalysis, normalize } from "./engine";

const KEY = "pulse.demo.v1";
const SESSION = "pulse.demo.session";
const PLATFORMS: Record<string, string> = { google_business: "Google Business Profile", facebook_page: "Facebook Page comments", messenger: "Facebook Messenger", manual: "Manual entry" };
const ROLE_PERMS: Record<string, string[]> = {
  SUPER_ADMIN: ["dashboard.view", "feedback.view", "feedback.manage", "feedback.review", "insights.generate", "reports.view", "reports.generate", "integrations.manage", "users.manage", "settings.manage", "audit.view"],
  ADMIN: ["dashboard.view", "feedback.view", "feedback.manage", "feedback.review", "insights.generate", "reports.view", "reports.generate", "audit.view"],
  ANALYST: ["dashboard.view", "feedback.view", "feedback.review", "insights.generate", "reports.view", "reports.generate"],
  VIEWER: ["dashboard.view", "reports.view"],
};
export const DEMO_ACCOUNTS = [
  { email: "admin@demo.likha", password: "Admin2026!", role: "SUPER_ADMIN", full_name: "Demo Super Admin" },
  { email: "analyst@demo.likha", password: "Analyst2026!", role: "ANALYST", full_name: "Demo Analyst" },
  { email: "viewer@demo.likha", password: "Viewer2026!", role: "VIEWER", full_name: "Demo Viewer" },
];

interface DemoUser extends UserRow { pw: string }
interface Rec extends FeedbackDetail { hash: string }
interface Store {
  feedback: Rec[]; notifications: (Notice & { dedupe: string; read_by: string[] })[]; reports: (ReportRow & { filters: Filters })[];
  audit: AuditRow[]; users: DemoUser[]; settings: SettingsData; insights: Insight[]; seq: number;
}

const DEFAULT_SETTINGS: SettingsData = {
  sentiment_thresholds: { negative_max: -25, positive_min: 25 }, confidence_thresholds: { high: 0.9, moderate: 0.7 },
  ai_provider: { provider: "rule", claude_model: "claude-opus-5-5", api_key_set: false },
  alerts: { negative_spike_pct: 30, repeated_complaint_count: 3, unresolved_days: 3, email_enabled: false },
  retention: { feedback_days: 730, audit_days: 1095 },
};

// ---------- sample data (same templates as backend/app/integrations/sample_data.py) ----------
const SERVICES = ["IV drip", "facial", "consultation", "laser session", "skin treatment"];
const STAFF = ["nurse", "receptionist", "doctor", "front desk staff", "therapist"];
const BRANCHES = ["Timog branch", "Mandaluyong branch", "QC branch"];
const TEMPLATES: Record<string, [string, number | null][]> = {
  google_business: [
    ["Ang ganda ng service! Super accommodating ng {staff}. Highly recommend!", 5], ["Clean and relaxing place. The {svc} was worth it, will come back.", 5],
    ["Okay naman ang {svc} pero sobrang tagal ng waiting time, almost 2 hours.", 2], ["Very professional doctors, you know you're in safe hands.", 5],
    ["Mahal for what you get. Expected more from the {svc}.", 2], ["Wow, excellent service! I waited for five hours.", 1],
    ["The {staff} was rude when I asked about my schedule. Disappointing.", 1], ["Malinis at maayos ang {branch}. Mabait ang mga staff.", 5],
    ["Good results after my third {svc} session. Salamat po!", 4], ["Average experience, nothing special.", 3],
    ["Parking is hard to find near the {branch}.", 3], ["Nagka-pantal ako after ng {svc}, sana ma-check ninyo kung bakit.", 1],
    ["Sulit ang promo package, smooth ang booking process.", 5], ["Booking online keeps failing, nag error yung form twice.", 2],
    ["Friendly staff pero medyo magulo ang pila sa reception.", 3],
  ],
  facebook_page: [
    ["Magkano po ang {svc} ngayon?", null], ["Available pa po ba ang promo hanggang December?", null], ["Ang galing ng results ko, salamat sa buong team!", null],
    ["Sana may branch kayo sa Cavite or Laguna.", null], ["Bakit po walang sumasagot sa page? Ilang araw na akong nag message.", null],
    ["Super satisfied with the {svc}! Glowing ang skin ko.", null], ["Okay sana pero disappointing ang experience sa {branch}.", null],
    ["Paano po mag book for this weekend?", null], ["Overpriced. Mas mura sa ibang clinic.", null], ["Grabe ang ganda ng lounge, very relaxing!", null],
    ["Seen lang yung message ko, nakakainis.", null], ["Thank you sa mabilis na reply kahapon!", null], ["Is the {svc} safe for pregnant women?", null],
    ["Hindi maganda ang experience ko, sobrang bagal ng process.", null], ["Congrats on 13 years! Best clinic ever.", null],
  ],
  messenger: [
    ["Hi po, pwede po bang magtanong about the {svc}?", null], ["Follow up lang po sa refund ko, wala pa rin hanggang ngayon.", null],
    ["Pa-assist po, hindi ko ma-book yung slot sa website.", null], ["Nag message na ako last week, any update po?", null],
    ["Thank you po sa accommodating na {staff}!", null], ["Nahilo po ako after ng {svc} kahapon, normal po ba yun?", null],
    ["Can I reschedule my appointment to Saturday?", null], ["Charged twice po ako sa GCash, paki check naman po.", null],
    ["Saan po ang exact address ng {branch}?", null], ["Ang tagal ng reply, 3 days na ako naghihintay.", null],
    ["Please call me, I need help with my package.", null], ["Salamat po, ang ganda ng resulta!", null], ["May slot pa po ba bukas ng hapon?", null],
    ["Hindi pa rin po resolved yung concern ko. Nakakadismaya.", null], ["Okay lang po, nakapag book na ako. Thanks!", null],
  ],
};

function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)];
const pickW = <T,>(r: () => number, items: T[], w: number[]) => { const s = w.reduce((a, b) => a + b, 0); let x = r() * s; for (let i = 0; i < items.length; i++) { x -= w[i]; if (x < 0) return items[i]; } return items[items.length - 1]; };

function generateSample(): { platform: string; content: string; rating: number | null; author: string; created_at: string }[] {
  const r = rng(13); const now = new Date(); now.setMinutes(0, 0, 0); const out = [];
  for (let d = 120; d >= 0; d--) {
    const recent = d < 21;
    const count = pickW(r, [0, 1, 2, 3], [1, 3, 3, recent ? 1.4 : 1]);
    for (let i = 0; i < count; i++) {
      const platform = pickW(r, ["google_business", "facebook_page", "messenger"], [0.35, 0.4, 0.25]);
      let pool = TEMPLATES[platform];
      if (recent) pool = [...pool, ...pool.filter(([t, rt]) => rt === 1 || rt === 2 || ["tagal", "wala pa", "seen", "update"].some((w) => t.toLowerCase().includes(w)))];
      const [tpl, rating] = pick(r, pool);
      const text = tpl.replace("{svc}", pick(r, SERVICES)).replace("{staff}", pick(r, STAFF)).replace("{branch}", pick(r, BRANCHES));
      const dt = new Date(now.getTime() - d * 86400000); dt.setHours(8 + Math.floor(r() * 14), Math.floor(r() * 60));
      out.push({ platform, content: text, rating, author: `sample-customer-${1 + Math.floor(r() * 60)}`, created_at: dt.toISOString() });
    }
  }
  return out;
}

// ---------- storage ----------
let store: Store | null = null;
async function sha(s: string) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join(""); }
const uid = () => Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-6);
const anon = (a?: string | null) => (a ? "user-" + simpleHash(a).slice(0, 10) : "anonymous");
function simpleHash(s: string) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, "0") + s.length.toString(16); }

function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage full or blocked: keep in memory */ } }

async function db(): Promise<Store> {
  if (store) return store;
  try { const raw = localStorage.getItem(KEY); if (raw) store = JSON.parse(raw); } catch { store = null; }
  if (!store) {
    const users: DemoUser[] = [];
    for (const a of DEMO_ACCOUNTS) users.push({ id: uid(), email: a.email, full_name: a.full_name, role: a.role, is_active: true, last_login_at: null, created_at: new Date().toISOString(), pw: await sha(a.password) });
    store = { feedback: [], notifications: [], reports: [], audit: [], users, settings: structuredClone(DEFAULT_SETTINGS), insights: [], seq: 1 };
    for (const s of generateSample()) ingest(s.platform, s.content, s.rating, s.author, s.created_at, true, false);
    periodicChecks();
    save();
  }
  return store;
}

function analyzeInto(rec: Partial<Rec> & { content: string; rating: number | null }, s: Store): Partial<Rec> {
  const neg7 = s.feedback.filter((f) => f.sentiment === "negative" && Date.now() - +new Date(f.created_at) < 7 * 86400000);
  const pre = fullAnalysis(rec.content, rec.rating, s.settings.sentiment_thresholds);
  const repeated = pre.label === "negative" ? neg7.filter((f) => f.topic === pre.primary_topic).length + 1 : 0;
  const a = repeated ? fullAnalysis(rec.content, rec.rating, s.settings.sentiment_thresholds, repeated) : pre;
  const lowConf = a.confidence < s.settings.confidence_thresholds.moderate || a.possible_sarcasm;
  return {
    sentiment: a.label, ai_sentiment: a.label, score: a.score, confidence: a.confidence, possible_sarcasm: a.possible_sarcasm, emotion: a.emotion,
    intent: a.intent, topics: a.topics, topic: a.primary_topic, priority: a.priority as Rec["priority"], engine: a.engine, language: a.language,
    reason: a.reason, recommended_action: a.recommended_action, intent_reason: a.intent_reason, priority_reason: a.priority_reason,
    ai: { sentiment: a.label, emotion: a.emotion, intent: a.intent, priority: a.priority }, emotion_scores: a.emotion_scores,
    model_version: a.model_version, analyzed_at: new Date().toISOString(),
    review_status: rec.review_status === "reviewed" ? "reviewed" : lowConf ? "pending_review" : "unreviewed",
    action_status: ["critical", "high"].includes(a.priority) && (rec.action_status ?? "open") === "open" ? "pending_action" : rec.action_status ?? "open",
  };
}

function ingest(platform: string, content: string, rating: number | null, author: string | null, created_at: string, sample: boolean, notify = true): Rec | null {
  const s = store!;
  const hash = simpleHash(`${platform}|${author ?? ""}|${normalize(content)}`);
  if (s.feedback.some((f) => f.platform === platform && f.hash === hash)) return null;
  const base = { content: content.trim(), rating } as Rec;
  const rec: Rec = {
    ...base, ...(analyzeInto(base, s) as Rec), id: uid(), hash, platform, platform_name: PLATFORMS[platform], author: anon(author),
    created_at, collected_at: new Date().toISOString(), is_sample: sample, source_url: null, external_id: null, parent_reference: null, reviews: [],
  };
  s.feedback.push(rec);
  if (notify) onNew(rec);
  return rec;
}

function push(kind: string, severity: string, title: string, message: string, dedupe: string, feedback_id: string | null = null) {
  const s = store!;
  if (s.notifications.some((n) => n.dedupe === dedupe)) return 0;
  s.notifications.unshift({ id: s.seq++, kind, severity, title, message, feedback_id, read: false, created_at: new Date().toISOString(), dedupe, read_by: [] });
  return 1;
}
function onNew(r: Rec) {
  const snip = r.content.length > 140 ? r.content.slice(0, 140) + "…" : r.content;
  if (r.priority === "critical") push("critical_feedback", "critical", `Critical feedback on ${r.platform_name}`, `${snip}\nReason: ${r.priority_reason}`, `critical:${r.id}`, r.id);
  else if (r.priority === "high") push("high_priority", "high", `High-priority feedback on ${r.platform_name}`, `${snip}\nReason: ${r.priority_reason}`, `high:${r.id}`, r.id);
}
function isoWeek(d: Date) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return `${t.getUTCFullYear()}-W${Math.ceil(((+t - +y) / 86400000 + 1) / 7)}`; }
function periodicChecks() {
  const s = store!; const cfg = s.settings.alerts; const now = Date.now(); const wk = isoWeek(new Date()); let n = 0;
  const inRange = (a: number, b: number) => s.feedback.filter((f) => { const t = +new Date(f.created_at); return t >= now - a * 86400000 && t < now - b * 86400000; });
  const cur = summarize(inRange(7, 0)).kpis, prev = summarize(inRange(14, 7)).kpis;
  if (cur.total >= 5 && prev.total >= 5 && cur.negative_pct - prev.negative_pct >= cfg.negative_spike_pct / 2 && cur.negative_pct >= prev.negative_pct * (1 + cfg.negative_spike_pct / 100))
    n += push("negative_spike", "high", "Negative sentiment increased", `Negative share rose from ${prev.negative_pct}% to ${cur.negative_pct}% in the last 7 days.`, `spike:${wk}`);
  const counts: Record<string, number> = {};
  for (const f of inRange(7, 0)) if (f.sentiment === "negative" && f.topic !== "General") counts[f.topic] = (counts[f.topic] ?? 0) + 1;
  for (const [t, c] of Object.entries(counts)) if (c >= cfg.repeated_complaint_count) n += push("repeated_complaint", "high", `Repeated complaints: ${t}`, `${c} negative messages about ${t} in the last 7 days.`, `repeated:${t}:${wk}`);
  for (const f of s.feedback) {
    const age = (now - +new Date(f.created_at)) / 86400000;
    if (["critical", "high"].includes(f.priority) && f.action_status !== "resolved" && age >= cfg.unresolved_days && age <= 60)
      n += push("unresolved", "high", "Unresolved high-priority feedback", `Open for more than ${cfg.unresolved_days} days: ${f.content.slice(0, 140)}`, `unresolved:${f.id}`, f.id);
  }
  return n;
}

// ---------- analytics (port of services/analytics.py) ----------
function bucket(iso: string, g: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (g === "year") return `${d.getFullYear()}`;
  if (g === "month") return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  if (g === "week") { const m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return `${m.getFullYear()}-${pad(m.getMonth() + 1)}-${pad(m.getDate())}`; }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const autoG = (from: Date, to: Date) => { const days = (+to - +from) / 86400000; return days <= 45 ? "day" : days <= 200 ? "week" : days <= 900 ? "month" : "year"; };
const count = <T extends string>(arr: T[]) => arr.reduce<Record<string, number>>((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {});
const top = (m: Record<string, number>, n: number) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);

function summarize(rows: Rec[], g = "day"): Omit<Dashboard, "period" | "latest_insight"> {
  const total = rows.length; const lab = count(rows.map((r) => r.sentiment)); const pr = count(rows.map((r) => r.priority));
  const pos = lab.positive ?? 0, neg = lab.negative ?? 0, neu = lab.neutral ?? 0;
  const pct = (n: number) => (total ? Math.round((1000 * n) / total) / 10 : 0);
  const avg = total ? Math.round((10 * rows.reduce((s, r) => s + r.score, 0)) / total) / 10 : 0;
  const plat: Record<string, Record<string, number>> = {}; const trend: Record<string, Record<string, number>> = {};
  const topics: Record<string, number> = {}, negT: Record<string, number> = {}, posT: Record<string, number> = {};
  for (const r of rows) {
    (plat[r.platform_name] ??= {})[r.sentiment] = (plat[r.platform_name][r.sentiment] ?? 0) + 1;
    const b = bucket(r.created_at, g); const tb = (trend[b] ??= { positive: 0, neutral: 0, negative: 0, _s: 0 }); tb[r.sentiment]++; tb._s += r.score;
    for (const t of r.topics) { if (t === "General") continue; topics[t] = (topics[t] ?? 0) + 1; if (r.sentiment === "negative") negT[t] = (negT[t] ?? 0) + 1; if (r.sentiment === "positive") posT[t] = (posT[t] ?? 0) + 1; }
  }
  return {
    kpis: { total, positive: pos, negative: neg, neutral: neu, pending_review: rows.filter((r) => r.review_status === "pending_review").length,
      high_priority: (pr.critical ?? 0) + (pr.high ?? 0), critical: pr.critical ?? 0,
      unresolved_high_priority: rows.filter((r) => r.action_status !== "resolved" && ["critical", "high"].includes(r.priority)).length,
      average_score: avg, positive_pct: pct(pos), negative_pct: pct(neg), neutral_pct: pct(neu),
      overall_sentiment_pct: pos + neg ? Math.round((1000 * pos) / (pos + neg)) / 10 : 0, sample_count: rows.filter((r) => r.is_sample).length },
    distribution: ["positive", "neutral", "negative"].map((k) => ({ name: k, value: lab[k] ?? 0 })),
    trend: Object.keys(trend).sort().map((b) => { const c = trend[b]; const n = c.positive + c.neutral + c.negative; return { period: b, positive: c.positive, neutral: c.neutral, negative: c.negative, avg_score: Math.round((10 * c._s) / Math.max(1, n)) / 10 }; }),
    by_platform: Object.keys(plat).sort().map((p) => ({ platform: p, positive: plat[p].positive ?? 0, neutral: plat[p].neutral ?? 0, negative: plat[p].negative ?? 0, total: Object.values(plat[p]).reduce((a, b) => a + b, 0) })),
    top_topics: top(topics, 8).map(([topic, c]) => ({ topic, count: c })), top_complaints: top(negT, 6).map(([topic, c]) => ({ topic, count: c })),
    most_appreciated: top(posT, 6).map(([topic, c]) => ({ topic, count: c })),
    emotions: top(count(rows.map((r) => r.emotion)), 20).map(([emotion, c]) => ({ emotion, count: c })),
    priorities: ["critical", "high", "medium", "low"].map((level) => ({ level, count: pr[level] ?? 0 })),
    intents: top(count(rows.map((r) => r.intent)), 20).map(([intent, c]) => ({ intent, count: c })), granularity: g,
  };
}

function period(f: Filters): [Date, Date] {
  const to = f.date_to ? new Date(f.date_to + (f.date_to.length === 10 ? "T23:59:59" : "")) : new Date();
  const from = f.date_from ? new Date(f.date_from + (f.date_from.length === 10 ? "T00:00:00" : "")) : new Date(+to - 30 * 86400000);
  return [from, to];
}
function filterRows(s: Store, f: Filters, usePeriod = false): Rec[] {
  const [from, to] = usePeriod ? period(f) : [f.date_from ? period(f)[0] : null, f.date_to ? period(f)[1] : null];
  return s.feedback.filter((r) => {
    const t = new Date(r.created_at);
    if (from && t < from) return false;
    if (to && t > to) return false;
    if (f.platform && r.platform !== f.platform) return false;
    if (f.sentiment && r.sentiment !== f.sentiment) return false;
    if (f.priority && !f.priority.split(",").includes(r.priority)) return false;
    if (f.emotion && r.emotion !== f.emotion) return false;
    if (f.intent && !f.intent.split(",").includes(r.intent)) return false;
    if (f.topic && !r.topics.includes(f.topic)) return false;
    if (f.review && r.review_status !== f.review) return false;
    if (f.action === "unresolved" ? r.action_status === "resolved" : f.action && r.action_status !== f.action) return false;
    if (f.search && !r.content.toLowerCase().includes(f.search.toLowerCase())) return false;
    if (f.include_sample === false && r.is_sample) return false;
    return true;
  }).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

// ---------- insights (port of services/insights.py) ----------
function aggregates(s: Store, f: Filters) {
  const [from, to] = period(f); const span = +to - +from;
  const cur = summarize(filterRows(s, { ...f, date_from: from.toISOString(), date_to: to.toISOString() }), autoG(from, to));
  const prev = summarize(filterRows(s, { ...f, date_from: new Date(+from - span).toISOString(), date_to: from.toISOString() }));
  const cn = Object.fromEntries(cur.top_complaints.map((t) => [t.topic, t.count])); const pn = Object.fromEntries(prev.top_complaints.map((t) => [t.topic, t.count]));
  const emerging = Object.entries(cn).filter(([t, n]) => n >= 2 && n >= 2 * Math.max(1, pn[t] ?? 0)).sort((a, b) => (b[1] - (pn[b[0]] ?? 0)) - (a[1] - (pn[a[0]] ?? 0))).slice(0, 4).map(([topic, now]) => ({ topic, now, before: pn[topic] ?? 0 }));
  return { period: { from: from.toISOString(), to: to.toISOString() }, current: cur.kpis, previous: prev.kpis, top_complaints: cur.top_complaints,
    most_appreciated: cur.most_appreciated, emotions: cur.emotions.slice(0, 5), emerging, recurring: Object.entries(cn).filter(([t, n]) => n >= 3 && (pn[t] ?? 0) >= 2).map(([t]) => t),
    assistance_requests: cur.intents.filter((i) => ["request_assistance", "follow_up_request"].includes(i.intent)).reduce((a, i) => a + i.count, 0), by_platform: cur.by_platform };
}
const sgn = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
function compose(agg: ReturnType<typeof aggregates>): InsightSummary {
  const c = agg.current, p = agg.previous;
  if (!c.total) return { overall: "No feedback was collected in the selected period, so there is nothing to summarize yet.", positives: "", complaints: "", emerging: "", recurring: "", trend: "", actions: "" };
  const delta = (a: number, b: number) => { const d = Math.round((a - b) * 10) / 10; return d === 0 ? "unchanged" : d > 0 ? `up ${d} points` : `down ${Math.abs(d)} points`; };
  let overall = `${c.total} feedback items were analyzed: ${c.positive} positive (${c.positive_pct}%), ${c.neutral} neutral (${c.neutral_pct}%) and ${c.negative} negative (${c.negative_pct}%). The average sentiment score is ${sgn(c.average_score)}. ${c.high_priority} item(s) are high priority or critical` + (c.pending_review ? `, and ${c.pending_review} are waiting for human review.` : ".");
  if (c.sample_count) overall += ` Note: ${c.sample_count} of these items are labeled sample data, not real customer feedback.`;
  const ma = agg.most_appreciated, tc = agg.top_complaints, em = agg.emerging; const acts: string[] = [];
  if (tc.length) acts.push(`Review the process behind ${tc[0].topic}, the top complaint topic, and assign an owner to monitor it.`);
  if (em.length) acts.push(`Investigate the rise in complaints about ${em[0].topic} before it becomes a recurring problem.`);
  if (c.unresolved_high_priority) acts.push(`Resolve the ${c.unresolved_high_priority} open high-priority or critical item(s) and close the loop with each customer.`);
  if (agg.assistance_requests) acts.push(`${agg.assistance_requests} message(s) asked for help or an update; check response handling and reply times.`);
  if (c.pending_review) acts.push(`Have a reviewer validate the ${c.pending_review} low-confidence or possibly sarcastic classifications.`);
  if (ma.length) acts.push(`Recognize the team for ${ma[0].topic}, the most appreciated area.`);
  return {
    overall,
    positives: ma.length ? `Positive feedback most often mentioned ${ma.slice(0, 3).map((t) => `${t.topic} (${t.count})`).join(", ")}.` : "No recurring positive topic stood out in this period.",
    complaints: tc.length ? `The most common complaints were about ${tc.slice(0, 3).map((t) => `${t.topic} (${t.count})`).join(", ")}.` : "No recurring complaint topic was found.",
    emerging: em.length ? `Emerging issues (complaints at least doubled versus the previous period): ${em.map((e) => `${e.topic} (${e.before} → ${e.now})`).join(", ")}.` : "No new issue grew sharply compared with the previous period.",
    recurring: agg.recurring.length ? `Recurring concerns seen in both this and the previous period: ${agg.recurring.join(", ")}.` : "No complaint topic repeated strongly across both periods.",
    trend: p.total ? `Compared with the previous period of the same length, negative share is ${delta(c.negative_pct, p.negative_pct)} (${p.negative_pct}% → ${c.negative_pct}%) and the average score moved from ${sgn(p.average_score)} to ${sgn(c.average_score)}.` : "There is no data for the previous period, so changes over time cannot be measured yet.",
    actions: acts.join(" ") || "No specific action is needed based on this period's data.",
  };
}

// ---------- helpers ----------
let me: Me | null = null;
const detail = (r: Rec): FeedbackDetail => { const { hash, ...rest } = r; void hash; return structuredClone(rest); };
const item = (r: Rec): FeedbackItem => { const d = detail(r); return d; };
function need(perm: string) { if (!me) throw new Error("Not signed in"); if (!me.permissions.includes(perm)) throw new Error(`Missing permission: ${perm}`); }
function log(action: string, entity = "", entity_id = "", details: unknown = {}) {
  const s = store!; s.audit.unshift({ id: s.seq++, actor: me?.email ?? "system", action, entity, entity_id, details, ip: "browser", created_at: new Date().toISOString() });
}
const toMe = (u: DemoUser): Me => ({ id: u.id, email: u.email, full_name: u.full_name, role: u.role, permissions: ROLE_PERMS[u.role] });
function download(name: string, data: BlobPart, type: string) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const HEAD = ["ID", "Platform", "Date", "Author", "Feedback", "Sentiment", "Score", "Confidence", "Emotion", "Intent", "Topics", "Priority", "Review status", "Sample data"];
const rowOf = (r: Rec) => [r.id.slice(0, 8), r.platform_name, r.created_at.slice(0, 16).replace("T", " "), r.author, r.content, r.sentiment, r.score, `${Math.round(r.confidence * 100)}%`, r.emotion, r.intent, r.topics.join(", "), r.priority, r.review_status, r.is_sample ? "yes" : "no"];
const REPORT_TYPES: Record<string, string> = { overall: "Overall Sentiment Report", platform: "Platform-Specific Report", negative: "Negative Feedback Report", positive: "Positive Feedback Report", complaints: "Complaint Analysis Report", priority: "Priority Concerns Report", monthly: "Monthly Sentiment Report", insights: "AI Insights and Recommendations" };
function scope(type: string, f: Filters): Filters {
  if (type === "negative") return { ...f, sentiment: "negative" };
  if (type === "positive") return { ...f, sentiment: "positive" };
  if (type === "complaints") return { ...f, intent: "complaint,reported_problem,follow_up_request" };
  if (type === "priority") return { ...f, priority: "critical,high" };
  return f;
}

export const demoApi: Api = {
  mode: "demo",
  async login(email, password) {
    const s = await db(); const u = s.users.find((x) => x.email === email.toLowerCase().trim());
    if (!u || !u.is_active || u.pw !== (await sha(password))) { log("login_failed", "user", "", { email }); save(); throw new Error("Incorrect email or password"); }
    u.last_login_at = new Date().toISOString(); me = toMe(u); log("login", "user", u.id); save();
    try { sessionStorage.setItem(SESSION, u.id); } catch { /* ignore */ }
    return me;
  },
  logout() { me = null; try { sessionStorage.removeItem(SESSION); } catch { /* ignore */ } },
  async me() { const s = await db(); let id: string | null = null; try { id = sessionStorage.getItem(SESSION); } catch { /* ignore */ } const u = s.users.find((x) => x.id === id && x.is_active); me = u ? toMe(u) : null; return me; },
  async dashboard(f, g) {
    need("dashboard.view"); const s = await db(); const [from, to] = period(f);
    const rows = filterRows(s, { ...f, date_from: from.toISOString(), date_to: to.toISOString() });
    const latest = s.insights[0];
    return { ...summarize(rows, g || autoG(from, to)), period: { from: from.toISOString(), to: to.toISOString() },
      latest_insight: latest ? { id: latest.id, summary: latest.summary, engine: latest.engine, created_at: latest.created_at, period: latest.period } : null };
  },
  async feedback(f, page, pageSize) { need("feedback.view"); const s = await db(); const rows = filterRows(s, f); return { total: rows.length, page, page_size: pageSize, items: rows.slice((page - 1) * pageSize, page * pageSize).map(item) }; },
  async feedbackDetail(id) { need("feedback.view"); const r = (await db()).feedback.find((x) => x.id === id); if (!r) throw new Error("Feedback not found"); return detail(r); },
  async addFeedback(content, author, rating) {
    need("feedback.manage"); await db(); const r = ingest("manual", content, rating ?? null, author ?? null, new Date().toISOString(), false);
    if (!r) throw new Error("This feedback was already recorded (duplicate)."); log("feedback_added", "feedback", r.id); save(); return detail(r);
  },
  async review(id, body) {
    need("feedback.review"); const s = await db(); const r = s.feedback.find((x) => x.id === id)!; const changes: unknown[] = [];
    for (const k of ["sentiment", "emotion", "intent", "priority"] as const) {
      const v = body[k]; if (v && v !== r[k]) { r.reviews.push({ field: k, original: String(r[k]), corrected: v, note: body.note ?? "", reviewer: me!.full_name, at: new Date().toISOString() }); (r as any)[k] = v; changes.push({ field: k, to: v }); }
    }
    if (!changes.length) r.reviews.push({ field: "confirm", original: r.sentiment, corrected: r.sentiment, note: body.note || "AI result confirmed", reviewer: me!.full_name, at: new Date().toISOString() });
    r.review_status = "reviewed"; log("feedback_reviewed", "feedback", id, { changes, note: body.note }); save(); return detail(r);
  },
  async setStatus(id, status) { need("feedback.manage"); const s = await db(); const r = s.feedback.find((x) => x.id === id)!; r.action_status = status; log("feedback_status", "feedback", id, { status }); save(); return detail(r); },
  async reanalyze(id) { need("feedback.manage"); const s = await db(); const r = s.feedback.find((x) => x.id === id)!; Object.assign(r, analyzeInto(r, s)); log("feedback_reanalyzed", "feedback", id); save(); return detail(r); },
  async analyze(text, rating) {
    need("feedback.view"); const s = await db(); const a = fullAnalysis(text, rating ?? null, s.settings.sentiment_thresholds); const ct = s.settings.confidence_thresholds;
    return { sentiment: a.label, score: a.score, confidence: a.confidence, confidence_band: a.confidence >= ct.high ? "high" : a.confidence >= ct.moderate ? "moderate" : "low (manual review)",
      emotion: a.emotion, intent: a.intent, intent_reason: a.intent_reason, topics: a.topics, possible_sarcasm: a.possible_sarcasm, reason: a.reason,
      priority: a.priority as any, priority_reason: a.priority_reason, recommended_action: a.recommended_action, language: a.language, engine: a.engine, model_version: a.model_version };
  },
  async generateInsight(f) {
    need("insights.generate"); const s = await db(); const agg = aggregates(s, f);
    const ins: Insight = { id: s.seq++, summary: compose(agg), aggregates: agg, engine: "rule", filters: Object.fromEntries(Object.entries(f).filter(([k, v]) => v && !k.startsWith("date"))), period: agg.period, created_at: new Date().toISOString() };
    s.insights.unshift(ins); s.insights = s.insights.slice(0, 20); log("insight_generated", "insight", String(ins.id)); save(); return ins;
  },
  async insights() { need("dashboard.view"); return (await db()).insights; },
  async integrations() {
    const s = await db();
    return Object.entries(PLATFORMS).map(([code, name]) => ({ code, name, status: code === "manual" ? "connected" : "not_connected",
      detail: code === "manual" ? "Feedback added by staff." : "Not connected. This demo runs entirely in your browser; connect official API credentials in the server version.",
      missing: code === "google_business" ? ["GOOGLE_BUSINESS_ACCESS_TOKEN", "GOOGLE_BUSINESS_ACCOUNT_ID", "GOOGLE_BUSINESS_LOCATION_ID"] : code === "manual" ? [] : ["META_PAGE_ID", "META_PAGE_ACCESS_TOKEN"],
      required_env: code === "google_business" ? ["GOOGLE_BUSINESS_ACCESS_TOKEN", "GOOGLE_BUSINESS_ACCOUNT_ID", "GOOGLE_BUSINESS_LOCATION_ID"] : code === "manual" ? [] : ["META_PAGE_ID", "META_PAGE_ACCESS_TOKEN"],
      docs_url: code === "google_business" ? "https://developers.google.com/my-business/content/review-data" : code === "facebook_page" ? "https://developers.facebook.com/docs/graph-api/reference/page/feed" : code === "messenger" ? "https://developers.facebook.com/docs/graph-api/reference/page/conversations" : "",
      last_sync_at: null, feedback_count: s.feedback.filter((f) => f.platform === code).length, sample_count: s.feedback.filter((f) => f.platform === code && f.is_sample).length }));
  },
  async sync(code) { need("integrations.manage"); log("integration_sync", "platform", code, { status: "not_connected" }); save(); return { platform: code, status: "not_connected", detail: "Demo mode: no platform credentials. Nothing was fetched.", added: 0 }; },
  async loadSample() { need("integrations.manage"); const s = await db(); let n = 0; for (const x of generateSample()) if (ingest(x.platform, x.content, x.rating, x.author, x.created_at, true, false)) n++; periodicChecks(); log("sample_data_loaded", "feedback", "", { added: n }); save(); return { added: n }; },
  async clearSample() { need("integrations.manage"); const s = await db(); const n = s.feedback.filter((f) => f.is_sample).length; s.feedback = s.feedback.filter((f) => !f.is_sample); log("sample_data_deleted", "feedback", "", { deleted: n }); save(); return { deleted: n }; },
  async notifications() { const s = await db(); periodicChecks(); save(); const items = s.notifications.slice(0, 50).map((n) => ({ ...n, read: !!me && n.read_by.includes(me.id) })); return { unread: items.filter((n) => !n.read).length, items }; },
  async markRead(id) { const s = await db(); const n = s.notifications.find((x) => x.id === id); if (n && me && !n.read_by.includes(me.id)) n.read_by.push(me.id); save(); },
  async markAllRead() { const s = await db(); for (const n of s.notifications) if (me && !n.read_by.includes(me.id)) n.read_by.push(me.id); save(); },
  async reportTypes() { return Object.entries(REPORT_TYPES).map(([code, name]) => ({ code, name })); },
  async reports() { need("reports.view"); return (await db()).reports; },
  async createReport(type, format, f) {
    need("reports.generate"); const s = await db();
    if (type === "platform" && !f.platform) throw new Error("Choose a platform for the platform-specific report.");
    let ff = { ...f };
    if (type === "monthly" && !f.date_from) { const n = new Date(); ff = { ...ff, date_from: new Date(n.getFullYear(), n.getMonth(), 1).toISOString(), date_to: n.toISOString() }; }
    const [from, to] = period(ff);
    const rep = { id: s.seq++, report_type: type, name: REPORT_TYPES[type], file_format: format, period: { from: from.toISOString(), to: to.toISOString() }, created_at: new Date().toISOString(), filters: ff };
    s.reports.unshift(rep); log("report_generated", "report", String(rep.id), { type, format }); save(); return rep;
  },
  async downloadReport(rep) {
    const s = await db(); const full = s.reports.find((x) => x.id === rep.id)!; const f = scope(full.report_type, full.filters);
    const [from, to] = period(f); const rows = filterRows(s, { ...f, date_from: from.toISOString(), date_to: to.toISOString() });
    const agg = aggregates(s, f); const text = compose(agg); const c = agg.current; const title = full.name + (f.platform ? ` — ${PLATFORMS[f.platform]}` : "");
    const per = `${from.toDateString()} – ${to.toDateString()}`;
    if (full.file_format === "csv") {
      const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      download(`${full.report_type}.csv`, "﻿" + [[title], [`Period: ${per}`], [], HEAD, ...rows.map(rowOf)].map((r) => r.map(q).join(",")).join("\r\n"), "text/csv");
      return;
    }
    const summaryRows = [["Total feedback", c.total], ["Positive", c.positive], ["Neutral", c.neutral], ["Negative", c.negative], ["Average sentiment score", c.average_score], ["High priority / critical", c.high_priority], ["Pending review", c.pending_review], ["Sample data items", c.sample_count]];
    const obs = Object.entries(text).filter(([, v]) => v).map(([k, v]) => `<p><b>${esc(k[0].toUpperCase() + k.slice(1))}.</b> ${esc(v)}</p>`).join("");
    const table = `<table border="1" cellspacing="0" cellpadding="4"><tr>${HEAD.map((h) => `<th>${h}</th>`).join("")}</tr>${rows.map((r) => `<tr>${rowOf(r).map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</table>`;
    if (full.file_format === "xlsx") {
      // Spreadsheet (HTML table format) that opens directly in Excel. The server version produces native .xlsx with charts.
      download(`${full.report_type}.xls`, `<html><head><meta charset="utf-8"></head><body><h2>${esc(title)}</h2><p>${per}</p><table border="1">${summaryRows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}</table><br>${obs}<br>${table}</body></html>`, "application/vnd.ms-excel");
      return;
    }
    const bar = (label: string, n: number, color: string) => `<div style="display:flex;align-items:center;gap:8px;margin:3px 0"><span style="width:70px">${label}</span><span style="height:12px;background:${color};width:${c.total ? (300 * n) / c.total : 0}px"></span><span>${n}</span></div>`;
    const w = window.open("", "_blank");
    if (!w) throw new Error("Allow pop-ups to open the printable PDF report.");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:12px Inter,Arial,sans-serif;color:#1e293b;margin:32px}h1{color:#0f1f3d;margin:0}h2{color:#0f1f3d;margin-top:22px}table{border-collapse:collapse;width:100%;font-size:10px}th{background:#eef1f6;text-align:left}td,th{border:1px solid #d5dae3;padding:4px;vertical-align:top}.k{display:flex;gap:10px;flex-wrap:wrap}.k div{border:1px solid #d5dae3;border-radius:6px;padding:8px 12px}.k b{display:block;font-size:18px;color:#0f1f3d}</style></head><body>
      <h1>${esc(title)}</h1><p>Reporting period: ${per} · Generated ${new Date().toLocaleString()}</p>${c.sample_count ? `<p style="color:#d64545">Includes ${c.sample_count} labeled sample-data items (not real customer feedback).</p>` : ""}
      <div class="k">${summaryRows.map(([k, v]) => `<div>${k}<b>${v}</b></div>`).join("")}</div><h2>Sentiment distribution</h2>${bar("Positive", c.positive, "#1f9d6b")}${bar("Neutral", c.neutral, "#8a94a6")}${bar("Negative", c.negative, "#d64545")}
      <h2>Key observations & recommendations</h2>${obs}<h2>Feedback (${rows.length})</h2>${table}<script>setTimeout(()=>print(),400)<\/script></body></html>`);
    w.document.close();
  },
  async users() { need("users.manage"); return (await db()).users.map(({ pw, ...u }) => { void pw; return u; }); },
  async createUser(u) {
    need("users.manage"); const s = await db();
    if (s.users.some((x) => x.email === u.email.toLowerCase())) throw new Error("A user with this email already exists");
    if (u.password.length < 10 || !/\d/.test(u.password) || !/[a-z]/i.test(u.password)) throw new Error("Password must be at least 10 characters with letters and numbers.");
    const nu: DemoUser = { id: uid(), email: u.email.toLowerCase(), full_name: u.full_name, role: u.role, is_active: true, last_login_at: null, created_at: new Date().toISOString(), pw: await sha(u.password) };
    s.users.push(nu); log("user_created", "user", nu.id, { email: nu.email, role: nu.role }); save(); const { pw, ...out } = nu; void pw; return out;
  },
  async updateUser(id, patch) {
    need("users.manage"); const s = await db(); const u = s.users.find((x) => x.id === id)!;
    if (u.id === me!.id && (patch.is_active === false || (patch.role && patch.role !== "SUPER_ADMIN"))) throw new Error("You cannot deactivate or demote your own account");
    if (patch.password) { if (patch.password.length < 10) throw new Error("Password must be at least 10 characters."); u.pw = await sha(patch.password); }
    if (patch.full_name) u.full_name = patch.full_name; if (patch.role) u.role = patch.role; if (patch.is_active !== undefined) u.is_active = patch.is_active;
    log("user_updated", "user", id, { ...patch, password: patch.password ? "reset" : undefined }); save(); const { pw, ...out } = u; void pw; return out;
  },
  async settings() { need("settings.manage"); return structuredClone((await db()).settings); },
  async saveSetting(key, value) {
    need("settings.manage"); const s = await db();
    if (key === "sentiment_thresholds" && !(Number(value.negative_max) < Number(value.positive_min))) throw new Error("negative_max must be lower than positive_min");
    if (key === "confidence_thresholds" && !(Number(value.moderate) < Number(value.high))) throw new Error("moderate must be lower than high");
    if (key === "ai_provider" && value.provider === "claude") throw new Error("The browser demo cannot call Claude. Set ANTHROPIC_API_KEY on the server version.");
    (s.settings as any)[key] = { ...(s.settings as any)[key], ...value }; log("setting_changed", "setting", key, value); save(); return s.settings[key];
  },
  async audit(action, page = 1) { need("audit.view"); const rows = (await db()).audit.filter((r) => !action || r.action === action); return rows.slice((page - 1) * 50, page * 50); },
};

export function resetDemo() { try { localStorage.removeItem(KEY); sessionStorage.removeItem(SESSION); } catch { /* ignore */ } store = null; me = null; }
