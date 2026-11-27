// Customer care: Facebook/Messenger/imported messages, suggested replies, keyword watch, client history,
// team report, weekly report and imports. Port twin: backend/app/quotes/care.py.
import RT from "./reply_templates.json";
import SM from "./sample_messages.json";
import PB from "./playbooks.json";
import { analyze } from "../sentiment/engine";
import { destByCode, peso } from "./engine";
import { rng } from "./history";
import { Case, ClockInfo, caseAct, caseView, clockStats, messageNeedsCase, openCase, requestClock, situationOf, stageAt } from "./clock";
import { THEME_LABEL, moodOf } from "./owner";
import { Actor, STATUSES, Settings, TravelRequest } from "./workflow";

export type Channel = "facebook_page" | "messenger" | "import";
export const CHANNEL_LABEL: Record<string, string> = { facebook_page: "Facebook comment", messenger: "Messenger", import: "Imported", website: "PAPH website" };
export interface CustomerMessage {
  id: string; channel: Channel; client: string; client_key: string; text: string; at: string; is_sample: boolean; is_imported: boolean;
  request_id: string | null; handled_by: { id: string; name: string } | null; first_reply_at: string | null; case_id: string | null; external_id: string | null;
}
const HOUR = 3600000;
const addMs = (iso: string, ms: number) => new Date(+new Date(iso) + ms).toISOString();
const r1 = (x: number) => Math.floor(x * 10 + 0.5) / 10;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const mins = (a: string, b: string) => (+new Date(b) - +new Date(a)) / 60000;

// ---------- who is the client ----------
/** One key per person: their name (for Facebook/Messenger) or their mobile/email (for website requests). */
export const nameKey = (name: string) => "n:" + name.trim().toLowerCase().replace(/\s+/g, " ");
export function contactKey(contact: string) {
  const c = contact.trim().toLowerCase();
  if (c.includes("@")) return "e:" + c;
  const d = c.replace(/\D/g, "");
  return d.length >= 7 ? "p:" + d.slice(-7) : nameKey(c);
}
export const requestKeys = (r: TravelRequest) => [contactKey(r.customer.contact), nameKey(r.customer.name)];
/** Real (not sample) names are shown as a short code when ANONYMIZE_AUTHORS is on (the server does this; the demo only has samples). */
export const clientLabel = (name: string, key: string, anonymize: boolean, sample: boolean) => (sample || !anonymize ? name : `Client ${key.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase()}`);

// ---------- messages ----------
export interface MessageView extends CustomerMessage { mood: "positive" | "neutral" | "negative"; score: number; theme: string; theme_label: string; clock: ClockInfo | null; watch_hits: string[]; reply_key: string; channel_label: string; request_ref: string | null }
export function messageClock(m: CustomerMessage, now: string, s: Settings): ClockInfo | null {
  if (m.first_reply_at || m.is_imported) return null;
  const due = addMs(m.at, s.request_reply_hours * HOUR);
  return { stage: stageAt(m.at, due, null, now), opened_at: m.at, due_at: due, label: "Reply" };
}
export function messageView(m: CustomerMessage, now: string, s: Settings, refOf: (id: string) => string | null = () => null): MessageView {
  const md = moodOf(m.text);
  return { ...m, mood: md.mood, score: md.score, theme: md.theme, theme_label: THEME_LABEL[md.theme] ?? md.theme, clock: messageClock(m, now, s), watch_hits: watchHits(m.text, s.watch_words), reply_key: replyKey(m.text), channel_label: CHANNEL_LABEL[m.channel], request_ref: m.request_id ? refOf(m.request_id) : null };
}
/** "I replied": stops the reply clock and records who handled it. */
export function markReplied(m: CustomerMessage, actor: Actor, now: string): CustomerMessage {
  if (m.first_reply_at) return m;
  return { ...m, first_reply_at: now, handled_by: { id: actor.id, name: actor.name } };
}
/** A new live message: saved, and an unhappy one opens a case right away. */
export function receiveMessage(p: { id: string; channel: Channel; client: string; text: string; at: string; is_sample?: boolean; is_imported?: boolean; external_id?: string | null }, caseId: string, s: Settings, owner: { id: string; name: string } | null = null): { message: CustomerMessage; case: Case | null } {
  const m: CustomerMessage = { id: p.id, channel: p.channel, client: p.client, client_key: nameKey(p.client), text: p.text.slice(0, 2000), at: p.at, is_sample: !!p.is_sample, is_imported: !!p.is_imported, request_id: null, handled_by: null, first_reply_at: p.is_imported ? p.at : null, case_id: null, external_id: p.external_id ?? null };
  if (!messageNeedsCase(m.text, m.is_imported)) return { message: m, case: null };
  const c = openCase({ id: caseId, now: p.at, source: "message", text: m.text, client: m.client, client_key: m.client_key, by: "PAPH AI", message_id: m.id, owner, is_sample: m.is_sample }, s);
  m.case_id = c.id;
  return { message: m, case: c };
}

// ---------- suggested replies ----------
export const REPLY_SITUATIONS = RT.situations as Record<string, string>;
export const REPLY_LANGUAGES: Record<string, string> = { en: "English", tl: "Taglish" };
export interface ReplyTemplate { id: number; situation: string; language: "en" | "tl"; title: string; body: string; is_default: boolean; updated_by: string; updated_at: string }
export const DEFAULT_REPLIES = RT.templates as { situation: string; language: "en" | "tl"; title: string; body: string }[];
/** Which kind of suggested reply fits what the customer wrote. */
export function replyKey(text: string, context: "message" | "changes" | "feedback" | "offer" = "message"): string {
  const a = analyze(text);
  const t = text.toLowerCase();
  const s = situationOf(text, a.primary_topic);
  if (context === "feedback") return a.label === "negative" ? "complaint" : "after_trip";
  if (context === "changes") return "changes";
  if (s === "documents") return "lost_passport";
  if (s === "emergency") return "emergency";
  if (a.label === "positive" || a.intent === "compliment" || a.intent === "appreciation") return "thank_you";
  if (s === "refund") return "refund";
  if (/\b(magkano|how much|price|presyo|rate|rates|promo)\b/.test(t)) return "price";
  if (s === "transfer" || a.primary_topic === "Waiting Time & Delays") return "delay";
  if (s === "hotel" || s === "visa" || s === "booking") return s;
  if (context === "offer") return "offer_follow_up";
  if (a.intent === "inquiry") return "inquiry";
  if (a.label === "negative" || ["complaint", "reported_problem", "follow_up_request"].includes(a.intent)) return "complaint";
  return "general";
}
/** Fills {name}, {range}, {ref}, {valid} where known; anything unknown stays as a blank to fill. */
export function fillReply(body: string, ctx: { name?: string; range?: string; ref?: string; valid?: string }): string {
  return body.replace(/\{(name|range|ref|valid)\}/g, (_, k: keyof typeof ctx) => ctx[k] ?? "____");
}

// ---------- keyword watch ----------
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Words found in the text. A word matches at the start of a word, so "cancel" also catches "cancelled". */
export function watchHits(text: string, words: string[]): string[] {
  const t = (text ?? "").toLowerCase();
  return words.filter((w) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(w.toLowerCase())}`, "u").test(t));
}
export function cleanWords(words: string[]): string[] {
  const out: string[] = [];
  for (const raw of words) {
    const w = String(raw).split(/\s+/).filter(Boolean).join(" ");
    if (w.length >= 2 && w.length <= 40 && !out.some((x) => x.toLowerCase() === w.toLowerCase())) out.push(w);
  }
  return out.slice(0, 50);
}
export interface WatchItem { at: string; text: string; client: string; where: string; ref: string | null; request_id: string | null; message_id: string | null; hits: string[]; mood: string }
/** Everything customers wrote in the last `days` days that contains a watched word. */
export function keywordWatch(requests: TravelRequest[], messages: CustomerMessage[], words: string[], days: number, now: string) {
  const from = addMs(now, -days * 24 * HOUR);
  const items: WatchItem[] = [];
  const add = (at: string, text: string, client: string, where: string, ref: string | null, request_id: string | null, message_id: string | null) => {
    if (at < from || !text) return;
    const hits = watchHits(text, words);
    if (hits.length) items.push({ at, text, client, where, ref, request_id, message_id, hits, mood: moodOf(text).mood });
  };
  for (const m of messages) add(m.at, m.text, m.client, CHANNEL_LABEL[m.channel], null, m.request_id, m.id);
  for (const r of requests) {
    add(r.created_at, r.raw_text, r.customer.name, "Trip request", r.ref, r.id, null);
    for (const e of r.events) if (e.action === "customer_question" || e.action === "customer_changes") add(e.at, e.note, r.customer.name, e.action === "customer_question" ? "Question on the offer" : "Change request", r.ref, r.id, null);
    if (r.feedback?.text) add(r.feedback.at, r.feedback.text, r.customer.name, "After-trip review", r.ref, r.id, null);
  }
  items.sort((a, b) => b.at.localeCompare(a.at));
  return { words, days, total: items.length, counts: words.map((w) => ({ word: w, count: items.filter((i) => i.hits.includes(w)).length })), items };
}

// ---------- client history ----------
export function clientHistory(key: string, requests: TravelRequest[], messages: CustomerMessage[], cases: Case[], now: string) {
  const reqs = requests.filter((r) => requestKeys(r).includes(key));
  const keys = new Set([key, ...reqs.flatMap(requestKeys)]);
  const msgs = messages.filter((m) => keys.has(m.client_key));
  const cs = cases.filter((c) => keys.has(c.client_key) || (c.request_id && reqs.some((r) => r.id === c.request_id)));
  const name = reqs[0]?.customer.name ?? msgs[0]?.client ?? cs[0]?.client ?? "Unknown client";
  type T = { at: string; kind: string; text: string; ref: string | null; request_id: string | null; mood: string | null };
  const timeline: T[] = [];
  for (const m of msgs) timeline.push({ at: m.at, kind: CHANNEL_LABEL[m.channel], text: m.text, ref: null, request_id: m.request_id, mood: moodOf(m.text).mood });
  for (const r of reqs) {
    timeline.push({ at: r.created_at, kind: "Trip request", text: r.raw_text || `${destByCode(r.input.destination)?.name ?? "Trip"}, ${r.input.days} days`, ref: r.ref, request_id: r.id, mood: moodOf(r.raw_text).mood });
    for (const e of r.events) {
      if (e.action === "customer_question" || e.action === "customer_changes") timeline.push({ at: e.at, kind: e.action === "customer_question" ? "Question" : "Change request", text: e.note, ref: r.ref, request_id: r.id, mood: moodOf(e.note).mood });
      if (e.action === "approve") timeline.push({ at: e.at, kind: "Quotation sent", text: `${peso(r.offer?.totals.price ?? 0)} offer approved`, ref: r.ref, request_id: r.id, mood: null });
      if (e.action === "mark_booked") timeline.push({ at: e.at, kind: "Booked", text: `${destByCode(r.input.destination)?.name ?? "Trip"} booked`, ref: r.ref, request_id: r.id, mood: null });
      if (e.action === "mark_lost") timeline.push({ at: e.at, kind: "Lost", text: e.note, ref: r.ref, request_id: r.id, mood: null });
    }
    if (r.feedback) timeline.push({ at: r.feedback.at, kind: `Rated ${r.feedback.rating} of 5`, text: r.feedback.text, ref: r.ref, request_id: r.id, mood: moodOf(r.feedback.text || `${r.feedback.rating} of 5 stars`, r.feedback.rating).mood });
  }
  for (const c of cs) timeline.push({ at: c.opened_at, kind: `Case: ${c.situation_label}`, text: c.text, ref: c.request_ref, request_id: c.request_id, mood: null });
  timeline.sort((a, b) => b.at.localeCompare(a.at));
  const moods = timeline.filter((t) => t.mood);
  const pos = moods.filter((t) => t.mood === "positive").length, neg = moods.filter((t) => t.mood === "negative").length;
  const openCases = cs.filter((c) => !c.resolved_at).length;
  const booked = reqs.filter((r) => r.status === "booked");
  const ratings = reqs.filter((r) => r.feedback).map((r) => r.feedback!.rating);
  const verdict = openCases ? `${openCases} open case${openCases > 1 ? "s" : ""}: reply to this traveller first.`
    : neg > pos ? "Mostly unhappy so far. Handle with extra care."
    : booked.length >= 2 ? `A loyal traveller: ${booked.length} trips booked. Say thank you.`
    : moods.length <= 1 ? "New traveller." : pos >= 2 * Math.max(1, neg) ? "A happy traveller." : "Mixed feelings so far.";
  return {
    key, name, contact: reqs[0]?.customer.contact ?? null, verdict, requests: reqs.map((r) => ({ id: r.id, ref: r.ref, status: r.status, status_label: STATUSES[r.status].staff, created_at: r.created_at, destination: destByCode(r.input.destination)?.name ?? r.input.place_text ?? "Trip", days: r.input.days, price: r.offer?.totals.price ?? null })),
    booked: booked.length, spent: booked.reduce((s, r) => s + (r.offer?.totals.price ?? 0), 0), rating: ratings.length ? r1(avg(ratings)!) : null,
    moods: { positive: pos, neutral: moods.length - pos - neg, negative: neg }, cases: cs.map((c) => caseView(c, now)), messages: msgs.length, timeline: timeline.slice(0, 80),
  };
}

// ---------- team report ----------
export function teamReport(requests: TravelRequest[], messages: CustomerMessage[], cases: Case[], months: number, now: string) {
  const from = addMs(now, -months * 30 * 24 * HOUR);
  type Row = { name: string; month: string; kind: string; ref: string; first_reply_minutes: number | null; resolution_minutes: number | null; status: "solved" | "replied" | "waiting" };
  const rows: Row[] = [];
  for (const m of messages) if (m.handled_by && !m.is_imported && m.at >= from) rows.push({ name: m.handled_by.name, month: m.at.slice(0, 7), kind: CHANNEL_LABEL[m.channel], ref: m.id, first_reply_minutes: m.first_reply_at ? Math.round(mins(m.at, m.first_reply_at)) : null, resolution_minutes: null, status: "replied" });
  for (const r of requests) {
    if (!r.assignee || r.created_at < from) continue;
    const first = r.events.find((e) => ["SALES", "AGENT", "ADMIN"].includes(e.role));
    rows.push({ name: r.assignee.name, month: r.created_at.slice(0, 7), kind: "Quotation request", ref: r.ref, first_reply_minutes: first ? Math.round(mins(r.created_at, first.at)) : null, resolution_minutes: null, status: first ? "replied" : "waiting" });
  }
  for (const c of cases) {
    if (!c.owner || c.opened_at < from) continue;
    rows.push({ name: c.owner.name, month: c.opened_at.slice(0, 7), kind: `Case: ${c.situation_label}`, ref: c.request_ref ?? c.id, first_reply_minutes: c.first_reply_at ? Math.round(mins(c.opened_at, c.first_reply_at)) : null, resolution_minutes: c.resolved_at ? Math.round(mins(c.opened_at, c.resolved_at)) : null, status: c.resolved_at ? "solved" : c.first_reply_at ? "replied" : "waiting" });
  }
  rows.sort((a, b) => b.month.localeCompare(a.month) || a.name.localeCompare(b.name));
  const stat = (rs: Row[]) => {
    const fr = rs.map((x) => x.first_reply_minutes).filter((x): x is number => x !== null), rs2 = rs.map((x) => x.resolution_minutes).filter((x): x is number => x !== null);
    const solvedCases = cases.filter((c) => c.resolved_at && c.opened_at >= from && c.owner && rs.some((x) => x.ref === (c.request_ref ?? c.id) && x.name === c.owner!.name));
    return { handled: rs.length, replied: rs.filter((x) => x.status !== "waiting").length, solved: rs.filter((x) => x.status === "solved").length,
      avg_first_reply_minutes: fr.length ? Math.round(avg(fr)!) : null, avg_resolution_minutes: rs2.length ? Math.round(avg(rs2)!) : null,
      cases_on_time_pct: solvedCases.length ? r1((solvedCases.filter((c) => c.resolved_at! <= c.due_at).length / solvedCases.length) * 100) : null };
  };
  const names = [...new Set(rows.map((r) => r.name))].sort();
  const monthsList = [...new Set(rows.map((r) => r.month))].sort().reverse();
  return {
    period: { from, to: now }, months: monthsList, team: names, totals: stat(rows),
    staff: names.map((n) => ({ name: n, ...stat(rows.filter((r) => r.name === n)) })).sort((a, b) => b.handled - a.handled || a.name.localeCompare(b.name)),
    by_month: monthsList.flatMap((mo) => names.map((n) => ({ month: mo, name: n, ...stat(rows.filter((r) => r.month === mo && r.name === n)) })).filter((x) => x.handled)),
    rows,
  };
}
export function teamReportCsv(rows: { name: string; month: string; kind: string; ref: string; first_reply_minutes: number | null; resolution_minutes: number | null; status: string }[]) {
  const esc = (x: unknown) => { const s = String(x ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [["Staff", "Month", "Type", "Reference", "First reply (minutes)", "Solved in (minutes)", "Status"], ...rows.map((r) => [r.name, r.month, r.kind, r.ref, r.first_reply_minutes ?? "", r.resolution_minutes ?? "", r.status])].map((x) => x.map(esc).join(",")).join("\r\n");
}

// ---------- weekly report (emailed Monday 8 AM Philippine time) ----------
export function weeklyReport(requests: TravelRequest[], messages: CustomerMessage[], cases: Case[], s: Settings, now: string) {
  const to = now, from = addMs(now, -7 * 24 * HOUR), prevFrom = addMs(now, -14 * 24 * HOUR);
  const inW = (at: string, a = from, b = to) => at >= a && at < b;
  const texts = (a: string, b: string) => [
    ...messages.filter((m) => inW(m.at, a, b)).map((m) => m.text),
    ...requests.flatMap((r) => [...(inW(r.created_at, a, b) ? [r.raw_text] : []), ...r.events.filter((e) => (e.action === "customer_question" || e.action === "customer_changes") && inW(e.at, a, b)).map((e) => e.note), ...(r.feedback && inW(r.feedback.at, a, b) ? [r.feedback.text || `${r.feedback.rating} of 5 stars`] : [])]),
  ].filter(Boolean);
  const cur = texts(from, to), prev = texts(prevFrom, from);
  const moods = cur.map((t) => moodOf(t)), prevMoods = prev.map((t) => moodOf(t));
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
  const neg = pct(moods.filter((m) => m.mood === "negative").length, moods.length), pos = pct(moods.filter((m) => m.mood === "positive").length, moods.length);
  const prevNeg = pct(prevMoods.filter((m) => m.mood === "negative").length, prevMoods.length);
  const themeCount = (pred: (m: { mood: string }) => boolean) => {
    const c: Record<string, number> = {};
    for (const m of moods) if (pred(m) && m.theme !== "General") c[m.theme] = (c[m.theme] ?? 0) + 1;
    return Object.entries(c).map(([k, n]) => ({ topic: THEME_LABEL[k] ?? k, count: n })).sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic)).slice(0, 3);
  };
  const booked = requests.filter((r) => r.status === "booked" && r.events.some((e) => e.action === "mark_booked" && inW(e.at)));
  const cs = clockStats(cases, now, from);
  const waiting = requests.filter((r) => requestClock(r, now, s)?.stage === "overdue").length;
  const watch = keywordWatch(requests, messages, s.watch_words, 7, now).counts.filter((c) => c.count);
  const team = teamReport(requests, messages, cases, 1, now).staff.slice(0, 5).map((x) => ({ name: x.name, handled: x.handled, avg_first_reply_minutes: x.avg_first_reply_minutes }));
  const complaints = themeCount((m) => m.mood === "negative");
  const actions: string[] = [];
  if (cs.by_stage.overdue) actions.push(`Close the ${cs.by_stage.overdue} overdue case${cs.by_stage.overdue > 1 ? "s" : ""} first.`);
  if (waiting) actions.push(`Reply to the ${waiting} quotation request${waiting > 1 ? "s" : ""} waiting over ${s.request_reply_hours} hours.`);
  if (complaints[0]) actions.push(`Look into ${complaints[0].topic.toLowerCase()}: the top complaint this week.`);
  if (!actions.length) actions.push("Keep it up: nothing urgent this week.");
  const verdict = !cur.length ? "A quiet week: no new customer messages." : neg > prevNeg + 5 ? `More unhappy customers than last week (${neg}% vs ${prevNeg}%).` : neg + 5 < prevNeg ? `Fewer unhappy customers than last week (${neg}% vs ${prevNeg}%).` : `A steady week: ${pos}% happy, ${neg}% unhappy messages.`;
  const listed = s.weekly_recipients.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  return {
    subject: `PAPH weekly report: ${from.slice(0, 10)} to ${to.slice(0, 10)}`, period: { from, to }, verdict,
    kpis: { messages: cur.length, positive_pct: pos, negative_pct: neg, prev_negative_pct: prevNeg, requests: requests.filter((r) => inW(r.created_at)).length, booked: booked.length, booked_revenue: booked.reduce((a, r) => a + (r.offer?.totals.price ?? 0), 0) },
    clock: { open: cs.open, overdue: cs.by_stage.overdue, red: cs.by_stage.red, solved: cs.solved, on_time_pct: cs.on_time_pct, requests_overdue: waiting },
    top_complaints: complaints, most_appreciated: themeCount((m) => m.mood === "positive"), watch, team, actions,
    enabled: s.weekly_enabled, recipients: listed, schedule: "Every Monday, 8:00 AM Philippine time",
  };
}

// ---------- import past messages (rows already read from CSV/XLSX in the browser) ----------
export interface ImportRow { date: string; client: string; message: string; channel: string }
export const MAX_IMPORT_ROWS = 5000;
export function parseDate(value: string): string | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  if (/^\d{4,5}(\.\d+)?$/.test(v)) { const n = parseFloat(v); if (n > 20000 && n < 80000) return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString(); }
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(v);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] - 8 : 0, m[5] ? +m[5] : 0)).toISOString();
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(v);
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return new Date(Date.UTC(y, +m[1] - 1, +m[2], m[4] ? +m[4] - 8 : 0, m[5] ? +m[5] : 0)).toISOString(); }
  return null;
}
export function channelCode(value: string): Channel {
  const v = String(value ?? "").toLowerCase();
  if (v.includes("messenger") || v.includes("chat") || v.includes("pm") || v.includes("inbox")) return "messenger";
  if (v.includes("facebook") || v.includes("fb") || v.includes("comment") || v.includes("post")) return "facebook_page";
  return "import";
}
/** Imported rows become already-handled history: counted in sentiment and reports, never open a case or a clock. */
export function importRows(existing: CustomerMessage[], rows: ImportRow[], now: string, idFor: (i: number) => string) {
  const seen = new Set(existing.map((m) => `${m.client_key}|${m.at.slice(0, 10)}|${m.text}`));
  const added: CustomerMessage[] = [], skipped: { row: number; reason: string }[] = [];
  let duplicates = 0;
  rows.slice(0, MAX_IMPORT_ROWS).forEach((r, i) => {
    const text = String(r.message ?? "").trim(), at = parseDate(r.date);
    if (!text) return skipped.push({ row: i + 2, reason: "No message" });
    if (!at) return skipped.push({ row: i + 2, reason: "Date not understood" });
    if (at > now) return skipped.push({ row: i + 2, reason: "Date is in the future" });
    const client = String(r.client ?? "").trim().slice(0, 120) || "Unknown client";
    const m = receiveMessage({ id: idFor(i), channel: channelCode(r.channel), client, text, at, is_imported: true }, "", { ...DEFAULT_IMPORT_SETTINGS }).message;
    const k = `${m.client_key}|${m.at.slice(0, 10)}|${m.text}`;
    if (seen.has(k)) { duplicates++; return; }
    seen.add(k); added.push(m);
  });
  if (rows.length > MAX_IMPORT_ROWS) skipped.push({ row: MAX_IMPORT_ROWS + 2, reason: `Only the first ${MAX_IMPORT_ROWS} rows are imported` });
  const by_channel: Record<string, number> = {};
  for (const m of added) by_channel[m.channel] = (by_channel[m.channel] ?? 0) + 1;
  return { added, result: { total: rows.length, imported: added.length, duplicates, skipped: skipped.slice(0, 50), skipped_count: skipped.length, by_channel } };
}
const DEFAULT_IMPORT_SETTINGS = { request_reply_hours: 24 } as Settings;

// ---------- sample messages and live cases (preview only) ----------
/** ~6 months of SAMPLE Facebook/Messenger messages, replied and handled; unhappy ones opened (and closed) cases. */
export function generateMessages(now: string, people: Actor[], customers: string[], s: Settings, firstCase: number): { messages: CustomerMessage[]; cases: Case[] } {
  const r = rng(SM.seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const end = +new Date(now);
  const messages: CustomerMessage[] = [], cases: Case[] = [];
  for (let i = 0; i < SM.count; i++) {
    const age = 2 + (SM.days - 2) * Math.pow(1 - i / SM.count, 1.3);
    const at = new Date(end - age * 24 * HOUR - Math.floor(r() * 12) * HOUR).toISOString();
    const channel: Channel = r() < 0.6 ? "facebook_page" : "messenger";
    const text = pick(channel === "facebook_page" ? SM.facebook_page : SM.messenger).replace("{svc}", pick(SM.services)).replace("{staff}", pick(SM.staff)).replace("{branch}", pick(SM.branches));
    const who = pick(people), client = pick(customers);
    const got = receiveMessage({ id: `msg-${i + 1}`, channel, client, text, at, is_sample: true }, `CASE-${String(firstCase + cases.length).padStart(4, "0")}`, s, { id: who.id, name: who.name });
    const replyMin = 10 + Math.floor(r() * (r() < 0.8 ? 180 : 1800));
    let m = markReplied(got.message, who, addMs(at, replyMin * 60000));
    if (got.case) {
      let c = caseAct(got.case, "reply", who, { note: "Called the traveller." }, addMs(at, replyMin * 60000), s);
      const solveH = c.priority === "urgent" ? 2 + r() * 30 : 4 + r() * 60;
      c = caseAct(c, "step", who, { index: 0 }, addMs(at, (replyMin + 30) * 60000), s);
      c = caseAct(c, "solve", who, { note: "Solved and confirmed with the traveller." }, addMs(at, solveH * HOUR), s);
      cases.push(c);
      m = { ...m, case_id: c.id };
    }
    messages.push(m);
  }
  return { messages, cases };
}

/** The live sample cases from playbooks.json (one at every colour), opened `hours_ago` before now. */
export function sampleLiveCases(now: string, people: Record<string, Actor>, s: Settings, firstCase: number, firstMsg: number): { messages: CustomerMessage[]; cases: Case[] } {
  const messages: CustomerMessage[] = [], cases: Case[] = [];
  (PB.sample_cases as { client: string; channel: Channel; hours_ago: number; owner: string | null; reply_after_min: number | null; steps_done: number; text: string }[]).forEach((x, i) => {
    const at = addMs(now, -x.hours_ago * HOUR);
    const owner = x.owner ? people[x.owner] : null;
    const got = receiveMessage({ id: `msg-${firstMsg + i}`, channel: x.channel, client: x.client, text: x.text, at, is_sample: true }, `CASE-${String(firstCase + i).padStart(4, "0")}`, s, owner ? { id: owner.id, name: owner.name } : null);
    let c = got.case ?? openCase({ id: `CASE-${String(firstCase + i).padStart(4, "0")}`, now: at, source: "message", text: x.text, client: x.client, client_key: got.message.client_key, by: "PAPH AI", message_id: got.message.id, owner: owner ? { id: owner.id, name: owner.name } : null, is_sample: true }, s);
    let m: CustomerMessage = { ...got.message, case_id: c.id };
    if (owner && x.reply_after_min !== null) {
      const t = addMs(at, x.reply_after_min * 60000);
      c = caseAct(c, "reply", owner, { note: "Called the traveller." }, t, s);
      m = markReplied(m, owner, t);
      for (let k = 0; k < x.steps_done; k++) c = caseAct(c, "step", owner, { index: k }, addMs(t, (k + 1) * 600000), s);
    }
    messages.push(m); cases.push(c);
  });
  return { messages, cases };
}
export { caseView };
