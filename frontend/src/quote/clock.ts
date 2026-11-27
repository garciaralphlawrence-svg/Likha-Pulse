// Response Clock. Every customer issue becomes a "case" with a deadline; quotation requests and unanswered
// messages also run on the same clock. The colour changes as time runs out
// (for a 24-hour target, every 6 hours): 0-25% of the time used = green, 25-50% yellow, 50-75% orange,
// 75-100% red (escalated to the owner), past the deadline = overdue.
// Port twin: backend/app/quotes/clock.py. Playbooks: backend/app/quotes/playbooks.json.
import PB from "./playbooks.json";
import { analyze } from "../sentiment/engine";
import type { ActionCode, Role, Settings, TravelRequest } from "./workflow";

export type Stage = "green" | "yellow" | "orange" | "red" | "overdue" | "solved";
export const STAGES: Record<Stage, { label: string; hint: string; color: string; soft: string }> = {
  green: { label: "On track", hint: "Plenty of time left", color: "#2f7d62", soft: "#e8f3ee" },
  yellow: { label: "Needs progress", hint: "A quarter of the time is gone", color: "#a07a12", soft: "#fbf4dc" },
  orange: { label: "At risk", hint: "Half of the time is gone", color: "#c0672c", soft: "#fbeadf" },
  red: { label: "Due soon", hint: "Less than a quarter of the time left", color: "#b4362a", soft: "#f9e1de" },
  overdue: { label: "Overdue", hint: "The deadline has passed", color: "#7a1f17", soft: "#f3d6d2" },
  solved: { label: "Solved", hint: "Case closed", color: "#5c6b63", soft: "#eef0ee" },
};
export const OPEN_STAGES: Stage[] = ["overdue", "red", "orange", "yellow", "green"];
export const SITUATIONS = PB.situations as Record<string, { label: string; steps: string[] }>;
const HOUR = 3600000;
const addMs = (iso: string, ms: number) => new Date(+new Date(iso) + ms).toISOString();

/** Colour for a clock that started at `opened` and must be done by `due`. */
export function stageAt(opened: string, due: string, resolved: string | null, now: string): Stage {
  if (resolved) return "solved";
  const a = +new Date(opened), b = +new Date(due);
  const f = (+new Date(now) - a) / Math.max(1, b - a);
  return f >= 1 ? "overdue" : f >= 0.75 ? "red" : f >= 0.5 ? "orange" : f >= 0.25 ? "yellow" : "green";
}
export const usedShare = (opened: string, due: string, now: string) =>
  Math.min(1, Math.max(0, (+new Date(now) - +new Date(opened)) / Math.max(1, +new Date(due) - +new Date(opened))));

/** Time in plain words: "45m", "3h 10m", "2d 4h". */
export function dur(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 48) return r ? `${h}h ${r}m` : `${h}h`;
  const d = Math.floor(h / 24), hh = h % 24;
  return hh ? `${d}d ${hh}h` : `${d}d`;
}

export interface ClockInfo { stage: Stage; opened_at: string; due_at: string; label: string }
const STAFF: Role[] = ["SALES", "AGENT", "ADMIN"];

/** The quotation clock: how long the customer has been waiting for us (first reply, a question, or a change request). */
export function requestClock(r: TravelRequest, now: string, s: Settings): ClockInfo | null {
  let opened: string | null = null, label = "";
  if (r.status === "new" || r.status === "ai_recommended") { opened = r.created_at; label = "First reply"; }
  else if (r.customer_question) { opened = r.customer_question.at; label = "Customer question"; }
  else if (r.status === "changes_requested") {
    const e = [...r.events].reverse().find((x) => x.to === "changes_requested");
    if (e?.role === "CUSTOMER") { opened = e.at; label = "Change request"; }
  }
  if (!opened) return null;
  if (r.events.some((e) => STAFF.includes(e.role) && e.at >= opened! && e.action !== "assign")) return null; // someone replied
  const due = addMs(opened, s.request_reply_hours * HOUR);
  return { stage: stageAt(opened, due, null, now), opened_at: opened, due_at: due, label };
}

// ---------- what kind of problem, and how urgent ----------
const has = (t: string, words: string[]) => words.some((w) => t.includes(w));
export function situationOf(text: string, topic: string): string {
  const t = text.toLowerCase();
  if (has(t, ["passport", "pasaporte"]) && has(t, ["nawala", "lost", "naiwan", "missing", "ninakaw", "stolen"])) return "documents";
  if (topic === "Safety & Health" || has(t, ["stranded", "naiwan", "aksidente", "naaksidente", "accident", "food poisoning", "lagnat", "nilalagnat", "emergency", "unsafe"])) return "emergency";
  if (has(t, ["confirmation", "e-ticket", "booking ko", "booking namin"]) && !has(t, ["refund", "charged"])) return "booking";
  if (topic === "Payment & Refunds" || has(t, ["refund", "charged", "gcash", "bayad"])) return "refund";
  if (topic === "Flights & Transfers" || has(t, ["flight", "sundo", "pickup", "pick up", "airport", "van", "transfer"])) return "transfer";
  if (topic === "Hotels & Accommodation" || has(t, ["hotel", "resort", "room"])) return "hotel";
  if (topic === "Visa & Travel Documents" || has(t, ["visa", "embassy"])) return "visa";
  if (topic === "Booking & Reservations" || has(t, ["booking", "confirmation", "ticket", "reservation"])) return "booking";
  if (["Tours & Itinerary", "Tour Guides & Staff", "Destinations", "Waiting Time & Delays"].includes(topic)) return "tour";
  return "general";
}
/** Signs that the traveller is on the trip right now (so every minute counts). */
export function travelingNow(text: string, situation: string): boolean {
  const t = text.toLowerCase();
  return situation === "emergency" || situation === "documents" || has(t, ["dito sa", "nandito", "right now", "ngayon", "stranded", "naiwan", "sa hotel", "sa airport"]);
}
const URGENT_SITUATIONS = ["emergency", "documents", "transfer", "hotel", "refund"];
export const priorityOf = (situation: string, traveling: boolean): "urgent" | "important" => (traveling || URGENT_SITUATIONS.includes(situation) ? "urgent" : "important");

// ---------- cases ----------
export interface CaseUpdate { at: string; by: string; kind: string; text: string }
export interface Case {
  id: string; opened_at: string; due_at: string; reply_due_at: string; priority: "urgent" | "important"; situation: string; situation_label: string;
  source: "message" | "request" | "feedback" | "manual"; text: string; client: string; client_key: string;
  request_id: string | null; request_ref: string | null; message_id: string | null; traveling_now: boolean;
  owner: { id: string; name: string } | null; first_reply_at: string | null; resolved_at: string | null;
  steps: { text: string; done: boolean }[]; updates: CaseUpdate[]; is_sample: boolean;
}
const SOURCE_WORD: Record<Case["source"], string> = { message: "a customer message", request: "a message on a quotation", feedback: "a low after-trip rating", manual: "staff" };

export function openCase(p: {
  id: string; now: string; source: Case["source"]; text: string; client: string; client_key: string; by: string; situation?: string | null;
  request?: { id: string; ref: string } | null; message_id?: string | null; owner?: { id: string; name: string } | null; is_sample?: boolean; rating?: number | null;
}, s: Settings): Case {
  const a = analyze(p.text, p.rating ?? null);
  const situation = p.situation && SITUATIONS[p.situation] ? p.situation : situationOf(p.text, a.primary_topic);
  const traveling = travelingNow(p.text, situation);
  const priority = p.source === "feedback" ? "important" : priorityOf(situation, traveling);
  const hours = priority === "urgent" ? s.urgent_hours : s.important_hours;
  const replyMin = priority === "urgent" ? s.urgent_reply_minutes : s.important_reply_minutes;
  return {
    id: p.id, opened_at: p.now, due_at: addMs(p.now, hours * HOUR), reply_due_at: addMs(p.now, replyMin * 60000), priority, situation, situation_label: SITUATIONS[situation].label,
    source: p.source, text: p.text.slice(0, 2000), client: p.client, client_key: p.client_key, request_id: p.request?.id ?? null, request_ref: p.request?.ref ?? null,
    message_id: p.message_id ?? null, traveling_now: traveling, owner: p.owner ?? null, first_reply_at: null, resolved_at: null,
    steps: SITUATIONS[situation].steps.map((t) => ({ text: t, done: false })), is_sample: !!p.is_sample,
    updates: [{ at: p.now, by: p.by, kind: "opened", text: `Case opened from ${SOURCE_WORD[p.source]}. ${priority === "urgent" ? `Urgent: solve within ${hours} hours` : `Important: solve within ${hours} hours`}.` }],
  };
}

/** When a customer's own words should open a case on their quotation request. */
export function autoCaseFor(action: ActionCode, note: string, rating: number | null): { source: Case["source"]; situation: string | null } | null {
  if (action === "customer_feedback") return rating !== null && rating <= 2 ? { source: "feedback", situation: null } : null;
  if ((action === "customer_question" || action === "customer_changes") && note.trim() && analyze(note).label === "negative") {
    const a = analyze(note);
    const sit = situationOf(note, a.primary_topic);
    return { source: "request", situation: action === "customer_changes" && !URGENT_SITUATIONS.includes(sit) ? "changes" : null };
  }
  return null;
}
/** Live (not imported) unhappy messages open a case. */
export const messageNeedsCase = (text: string, imported: boolean) => !imported && analyze(text).label === "negative";

export type CaseAction = "assign" | "reply" | "step" | "note" | "solve" | "reopen" | "traveling";
export class CaseError extends Error {}
const fail = (m: string): never => { throw new CaseError(m); };

/** One step on a case. Owner (ADMIN) can do anything; others work cases they own or whose request is assigned to them. */
export function caseAct(prev: Case, action: CaseAction, actor: { id: string; name: string; role: Role }, payload: { note?: string; index?: number; value?: boolean; assignee?: { id: string; name: string } },
  now: string, s: Settings, requestAssigneeId: string | null = null): Case {
  const c: Case = JSON.parse(JSON.stringify(prev));
  const note = (payload.note ?? "").trim().slice(0, 1000);
  const mine = actor.role === "ADMIN" || c.owner?.id === actor.id || (!c.owner && requestAssigneeId === actor.id);
  if (action === "assign") {
    const a = payload.assignee ?? fail("Choose who handles this case.");
    if (actor.role !== "ADMIN" && a.id !== actor.id) fail("Only the owner can give a case to someone else.");
    if (actor.role !== "ADMIN" && c.owner && c.owner.id !== actor.id) fail(`This case belongs to ${c.owner.name}.`);
    c.owner = { id: a.id, name: a.name };
    c.updates.push({ at: now, by: actor.name, kind: "assigned", text: `Assigned to ${a.name}.` });
    return c;
  }
  if (!mine) fail(c.owner ? `This case belongs to ${c.owner.name}. Ask the owner to reassign it.` : "Take this case first.");
  if (c.resolved_at && action !== "reopen") fail("This case is already solved.");
  switch (action) {
    case "reply":
      if (!c.first_reply_at) c.first_reply_at = now;
      c.updates.push({ at: now, by: actor.name, kind: "reply", text: note || "Replied to the customer." });
      break;
    case "step": {
      const i = payload.index ?? -1;
      if (!c.steps[i]) fail("Unknown step.");
      c.steps[i].done = !c.steps[i].done;
      c.updates.push({ at: now, by: actor.name, kind: "step", text: `${c.steps[i].done ? "Done" : "Not done"}: ${c.steps[i].text}` });
      break;
    }
    case "note":
      if (!note) fail("Please write a short note.");
      c.updates.push({ at: now, by: actor.name, kind: "note", text: note });
      break;
    case "solve":
      if (!c.first_reply_at) c.first_reply_at = now;
      c.resolved_at = now;
      c.updates.push({ at: now, by: actor.name, kind: "solved", text: note || "Solved." });
      break;
    case "reopen":
      if (!c.resolved_at) fail("This case is still open.");
      c.resolved_at = null;
      c.opened_at = now;
      c.due_at = addMs(now, (c.priority === "urgent" ? s.urgent_hours : s.important_hours) * HOUR);
      c.reply_due_at = addMs(now, (c.priority === "urgent" ? s.urgent_reply_minutes : s.important_reply_minutes) * 60000);
      c.updates.push({ at: now, by: actor.name, kind: "reopened", text: note || "Reopened. The clock starts again." });
      break;
    case "traveling":
      c.traveling_now = !!payload.value;
      c.updates.push({ at: now, by: actor.name, kind: "traveling", text: c.traveling_now ? "Marked as on a trip now." : "No longer marked as on a trip." });
      break;
    default:
      fail("Unknown step.");
  }
  return c;
}

export interface CaseView extends Case { stage: Stage; used: number; escalated: boolean; reply_stage: Stage | null; steps_done: number; on_time: boolean | null }
export function caseView(c: Case, now: string): CaseView {
  const stage = stageAt(c.opened_at, c.due_at, c.resolved_at, now);
  return {
    ...c, stage, used: usedShare(c.opened_at, c.due_at, c.resolved_at ?? now), escalated: stage === "red" || stage === "overdue",
    reply_stage: c.first_reply_at || c.resolved_at ? null : stageAt(c.opened_at, c.reply_due_at, null, now), steps_done: c.steps.filter((x) => x.done).length,
    on_time: c.resolved_at ? c.resolved_at <= c.due_at : null,
  };
}
const rank: Record<Stage, number> = { overdue: 0, red: 1, orange: 2, yellow: 3, green: 4, solved: 5 };
export function sortCases(vs: CaseView[]): CaseView[] {
  return [...vs].sort((a, b) => rank[a.stage] - rank[b.stage] || b.used - a.used || a.opened_at.localeCompare(b.opened_at));
}

export interface ClockStats {
  open: number; by_stage: Record<string, number>; escalated: number; traveling_now: number; no_reply_yet: number;
  solved: number; on_time_pct: number | null; avg_solve_minutes: number | null; avg_first_reply_minutes: number | null;
  by_person: { id: string; name: string; open: number; solved: number; on_time_pct: number | null; avg_solve_minutes: number | null }[];
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (x: number | null) => (x === null ? null : Math.floor(x * 10 + 0.5) / 10);
const mins = (a: string, b: string) => (+new Date(b) - +new Date(a)) / 60000;

/** Counts per colour (open cases) and solve stats (cases solved since `from`). */
export function clockStats(cases: Case[], now: string, from: string | null = null): ClockStats {
  const vs = cases.map((c) => caseView(c, now));
  const open = vs.filter((v) => !v.resolved_at), solved = vs.filter((v) => v.resolved_at && (!from || v.resolved_at >= from));
  const by_stage: Record<string, number> = { overdue: 0, red: 0, orange: 0, yellow: 0, green: 0 };
  for (const v of open) by_stage[v.stage]++;
  const people = new Map<string, { id: string; name: string; o: CaseView[]; s: CaseView[] }>();
  for (const v of [...open, ...solved]) {
    if (!v.owner) continue;
    const p = people.get(v.owner.id) ?? { id: v.owner.id, name: v.owner.name, o: [], s: [] };
    (v.resolved_at ? p.s : p.o).push(v); people.set(v.owner.id, p);
  }
  const pct = (a: number, b: number) => (b ? r1((a / b) * 100) : null);
  const solveMin = (xs: CaseView[]) => { const m = avg(xs.map((v) => mins(v.opened_at, v.resolved_at!))); return m === null ? null : Math.round(m); };
  return {
    open: open.length, by_stage, escalated: open.filter((v) => v.escalated).length, traveling_now: open.filter((v) => v.traveling_now).length,
    no_reply_yet: open.filter((v) => !v.first_reply_at).length, solved: solved.length, on_time_pct: pct(solved.filter((v) => v.on_time).length, solved.length),
    avg_solve_minutes: solveMin(solved), avg_first_reply_minutes: (() => { const m = avg(solved.filter((v) => v.first_reply_at).map((v) => mins(v.opened_at, v.first_reply_at!))); return m === null ? null : Math.round(m); })(),
    by_person: [...people.values()].map((p) => ({ id: p.id, name: p.name, open: p.o.length, solved: p.s.length, on_time_pct: pct(p.s.filter((v) => v.on_time).length, p.s.length), avg_solve_minutes: solveMin(p.s) }))
      .sort((a, b) => b.solved + b.open - (a.solved + a.open) || a.name.localeCompare(b.name)),
  };
}
