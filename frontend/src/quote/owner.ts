// Owner-only dashboards: briefing, customer sentiment, team performance, revenue and margin.
// Port twin: backend/app/quotes/owner.py. Sentiment comes from the free rule engine (src/sentiment/engine.ts).
import { analyze } from "../sentiment/engine";
import { destByCode, peso } from "./engine";
import { LOST_REASONS, STATUSES, Status, TravelRequest, hoursWaiting } from "./workflow";

export type Range = "30" | "90" | "year" | "all";
export interface OwnerFilters { range: Range; destination: string; salesperson: string }
export type Mood = "positive" | "neutral" | "negative";
export interface Voice {
  request_id: string; ref: string; at: string; kind: "request" | "question" | "changes" | "feedback"; kind_label: string; text: string;
  customer: string; destination: string; destination_name: string; salesperson: string; status: Status; mood: Mood; score: number;
  theme: string; theme_label: string; rating: number | null; is_sample: boolean;
}
export interface Slice { key: string; label: string; count: number; positive: number; neutral: number; negative: number; score: number }
export interface Theme { theme: string; label: string; count: number; positive: number; negative: number; requests: number; examples: Voice[] }
export interface TeamRow {
  id: string; name: string; handled: number; avg_response_hours: number | null; offers_sent: number; approval_rate: number | null; booking_rate: number | null;
  revenue: number; avg_margin_pct: number | null; sentiment_score: number | null; voices: number;
}
export interface OwnerReport {
  filters: OwnerFilters; period: { from: string | null; to: string }; sample_count: number; requests: number;
  briefing: { verdict: string; bullets: string[] };
  sentiment: {
    total: number; positive: number; neutral: number; negative: number; positive_pct: number; negative_pct: number; avg_score: number;
    trend: (Slice & { period: string })[]; by_destination: Slice[]; by_salesperson: Slice[]; by_stage: Slice[]; themes: Theme[]; attention: Voice[];
    ratings: { avg: number | null; count: number; stars: number[] };
  };
  team: TeamRow[];
  revenue: {
    booked: number; bookings: number; margin: number; margin_pct: number | null; pipeline: number; pipeline_count: number; avg_booking: number | null; quote_to_book_pct: number | null;
    by_month: { period: string; label: string; revenue: number; margin: number; bookings: number }[];
    by_destination: { key: string; label: string; revenue: number; margin: number; bookings: number }[];
    funnel: { step: string; label: string; count: number }[]; lost_reasons: { reason: string; label: string; count: number }[];
  };
  voices: Voice[];
  options: { destinations: { code: string; name: string }[]; salespeople: { id: string; name: string }[] };
}

export const THEME_LABEL: Record<string, string> = {
  "Response Time": "Slow replies", "Waiting Time & Delays": "Delays and waiting", "Tour Guides & Staff": "Staff and guides", "Tours & Itinerary": "Tours and itinerary",
  "Pricing & Promos": "Price", "Hotels & Accommodation": "Hotels", "Booking & Reservations": "Booking", "Flights & Transfers": "Flights and transfers",
  "Visa & Travel Documents": "Visa and documents", "Safety & Health": "Safety and health", "Payment & Refunds": "Payments and refunds", Destinations: "The destination",
  "Online Experience": "Website and messages", General: "General",
};
const KIND_LABEL: Record<Voice["kind"], string> = { request: "Trip request", question: "Question on the offer", changes: "Asked for changes", feedback: "After-trip review" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86400000;
const round1 = (x: number) => Math.floor(x * 10 + 0.5) / 10;
const pct = (a: number, b: number) => (b ? round1((a / b) * 100) : null);
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const cache = new Map<string, { mood: Mood; score: number; theme: string }>();

/** Sentiment of one piece of customer writing (cached; the engine is deterministic). */
export function moodOf(text: string, rating: number | null = null) {
  const key = `${rating ?? ""}|${text}`;
  let v = cache.get(key);
  if (!v) { const a = analyze(text, rating); v = { mood: a.label, score: a.score, theme: a.primary_topic }; cache.set(key, v); }
  return v;
}

export function rangeStart(range: Range, now: string): string | null {
  if (range === "all") return null;
  if (range === "year") return `${now.slice(0, 4)}-01-01T00:00:00.000Z`;
  return new Date(+new Date(now) - Number(range) * DAY).toISOString();
}
const bookedAt = (r: TravelRequest) => [...r.events].reverse().find((e) => e.action === "mark_booked")?.at ?? null;
const has = (r: TravelRequest, action: string) => r.events.some((e) => e.action === action);

/** Everything a customer wrote, each with its sentiment. */
export function voicesOf(r: TravelRequest): Voice[] {
  const d = destByCode(r.input.destination);
  const base = { request_id: r.id, ref: r.ref, customer: r.customer.name, destination: d?.code ?? "other", destination_name: d?.name ?? r.input.place_text ?? "Other places", salesperson: r.assignee?.name ?? "Unassigned", status: r.status, is_sample: r.is_sample };
  const out: Voice[] = [];
  const push = (kind: Voice["kind"], at: string, text: string, rating: number | null = null, readAs = text) => {
    if (!text.trim()) return;
    const m = moodOf(readAs, rating);
    out.push({ ...base, kind, kind_label: KIND_LABEL[kind], at, text, rating, mood: m.mood, score: m.score, theme: m.theme, theme_label: THEME_LABEL[m.theme] ?? m.theme });
  };
  // "budget friendly" in a trip request is a price preference, not praise
  if (r.raw_text) push("request", r.created_at, r.raw_text, null, r.raw_text.replace(/budget[\s-]?friendly/gi, "budget"));
  for (const e of r.events) {
    if (e.action === "customer_question") push("question", e.at, e.note);
    if (e.action === "customer_changes") push("changes", e.at, e.note);
  }
  if (r.feedback) push("feedback", r.feedback.at, r.feedback.text || `${r.feedback.rating} of 5 stars`, r.feedback.rating);
  return out;
}

function slice(key: string, label: string, vs: Voice[]): Slice {
  const c = (m: Mood) => vs.filter((v) => v.mood === m).length;
  return { key, label, count: vs.length, positive: c("positive"), neutral: c("neutral"), negative: c("negative"), score: Math.round(avg(vs.map((v) => v.score)) ?? 0) };
}
function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) { const k = key(x); m.set(k, [...(m.get(k) ?? []), x]); }
  return m;
}
const mondayOf = (iso: string) => { const d = new Date(iso.slice(0, 10) + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

export function ownerReport(all: TravelRequest[], f: OwnerFilters, now: string): OwnerReport {
  const from = rangeStart(f.range, now);
  const scoped = all.filter((r) => (!f.destination || (r.input.destination ?? "other") === f.destination) && (!f.salesperson || r.assignee?.id === f.salesperson));
  const reqs = scoped.filter((r) => !from || r.created_at >= from);
  const voices = scoped.flatMap(voicesOf).filter((v) => !from || v.at >= from).sort((a, b) => b.at.localeCompare(a.at));

  // ---- sentiment
  const total = voices.length, positive = voices.filter((v) => v.mood === "positive").length, negative = voices.filter((v) => v.mood === "negative").length;
  const weekly = f.range === "30";
  const trend = [...groupBy(voices, (v) => (weekly ? mondayOf(v.at) : v.at.slice(0, 7))).entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([k, vs]) => ({ ...slice(k, weekly ? `Week of ${MONTHS[Number(k.slice(5, 7)) - 1]} ${Number(k.slice(8, 10))}` : monthLabel(k), vs), period: k }));
  const slices = (key: (v: Voice) => string, label: (v: Voice) => string) =>
    [...groupBy(voices, key).entries()].map(([k, vs]) => slice(k, label(vs[0]), vs)).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  // topics come from what customers say about the service (questions, change requests, reviews), not from trip requests
  const themeVoices = voices.filter((v) => v.kind !== "request");
  const themes: Theme[] = [...groupBy(themeVoices.filter((v) => v.theme !== "General"), (v) => v.theme).entries()].map(([k, vs]) => ({
    theme: k, label: THEME_LABEL[k] ?? k, count: vs.length, positive: vs.filter((v) => v.mood === "positive").length, negative: vs.filter((v) => v.mood === "negative").length,
    requests: new Set(vs.filter((v) => v.mood === "negative").map((v) => v.request_id)).size,
    examples: [...vs].sort((a, b) => (a.mood === "negative" ? 0 : 1) - (b.mood === "negative" ? 0 : 1) || b.at.localeCompare(a.at)).slice(0, 3),
  })).sort((a, b) => b.negative - a.negative || b.count - a.count || a.label.localeCompare(b.label));
  const rated = voices.filter((v) => v.kind === "feedback" && v.rating);
  const stars = [1, 2, 3, 4, 5].map((n) => rated.filter((v) => v.rating === n).length);

  // ---- team
  const byPerson = groupBy(reqs.filter((r) => r.assignee), (r) => r.assignee!.id);
  const team: TeamRow[] = [...byPerson.entries()].map(([id, rs]) => {
    const resp = rs.map((r) => { const e = r.events.find((x) => x.role === "SALES" || x.role === "ADMIN" || x.role === "AGENT"); return e ? (+new Date(e.at) - +new Date(r.created_at)) / 3600000 : null; }).filter((x): x is number => x !== null);
    const decided = rs.filter((r) => has(r, "approve") || has(r, "request_changes") || has(r, "decline"));
    const approved = rs.filter((r) => has(r, "approve"));
    const booked = rs.filter((r) => r.status === "booked");
    const vs = voices.filter((v) => rs.some((r) => r.id === v.request_id));
    const margins = approved.filter((r) => r.offer).map((r) => r.offer!.totals.margin_pct);
    return {
      id, name: rs[0].assignee!.name, handled: rs.length, avg_response_hours: resp.length ? round1(avg(resp)!) : null, offers_sent: rs.filter((r) => has(r, "submit")).length,
      approval_rate: pct(approved.length, decided.length), booking_rate: pct(booked.length, approved.length), revenue: booked.reduce((s, r) => s + (r.offer?.totals.price ?? 0), 0),
      avg_margin_pct: margins.length ? round1(avg(margins)!) : null, sentiment_score: vs.length ? Math.round(avg(vs.map((v) => v.score))!) : null, voices: vs.length,
    };
  }).sort((a, b) => b.revenue - a.revenue || b.handled - a.handled);

  // ---- revenue (booked trips count in the month they were booked)
  const bookedReqs = scoped.filter((r) => r.status === "booked" && r.offer && (!from || (bookedAt(r) ?? "") >= from));
  const booked = bookedReqs.reduce((s, r) => s + r.offer!.totals.price, 0), margin = bookedReqs.reduce((s, r) => s + r.offer!.totals.margin, 0);
  const pipelineReqs = reqs.filter((r) => ["approved", "sent", "accepted", "pending_approval"].includes(r.status) && r.offer);
  const by_month = [...groupBy(bookedReqs, (r) => bookedAt(r)!.slice(0, 7)).entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([k, rs]) => ({ period: k, label: monthLabel(k), revenue: rs.reduce((s, r) => s + r.offer!.totals.price, 0), margin: rs.reduce((s, r) => s + r.offer!.totals.margin, 0), bookings: rs.length }));
  const by_destination = [...groupBy(bookedReqs, (r) => r.input.destination ?? "other").entries()]
    .map(([k, rs]) => ({ key: k, label: destByCode(k)?.name ?? "Other places", revenue: rs.reduce((s, r) => s + r.offer!.totals.price, 0), margin: rs.reduce((s, r) => s + r.offer!.totals.margin, 0), bookings: rs.length }))
    .sort((a, b) => b.revenue - a.revenue || a.label.localeCompare(b.label));
  const funnel = [
    { step: "requests", label: "Requests received", count: reqs.length },
    { step: "drafted", label: "Offer prepared", count: reqs.filter((r) => has(r, "start_offer")).length },
    { step: "submitted", label: "Sent for approval", count: reqs.filter((r) => has(r, "submit")).length },
    { step: "approved", label: "Approved and quoted", count: reqs.filter((r) => has(r, "approve")).length },
    { step: "accepted", label: "Customer accepted", count: reqs.filter((r) => has(r, "customer_accept")).length },
    { step: "booked", label: "Booked", count: reqs.filter((r) => r.status === "booked").length },
  ];
  const lost = groupBy(reqs.filter((r) => r.status === "lost" && r.lost_reason), (r) => r.lost_reason!);
  const lost_reasons = [...lost.entries()].map(([k, rs]) => ({ reason: k, label: LOST_REASONS[k] ?? k, count: rs.length })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const report: OwnerReport = {
    filters: f, period: { from, to: now }, sample_count: reqs.filter((r) => r.is_sample).length, requests: reqs.length,
    briefing: { verdict: "", bullets: [] },
    sentiment: {
      total, positive, neutral: total - positive - negative, negative, positive_pct: pct(positive, total) ?? 0, negative_pct: pct(negative, total) ?? 0,
      avg_score: Math.round(avg(voices.map((v) => v.score)) ?? 0), trend,
      by_destination: slices((v) => v.destination, (v) => v.destination_name), by_salesperson: slices((v) => v.salesperson, (v) => v.salesperson),
      by_stage: slices((v) => v.status, (v) => STATUSES[v.status].staff), themes,
      attention: voices.filter((v) => v.mood === "negative").slice(0, 12),
      ratings: { avg: rated.length ? round1(avg(rated.map((v) => v.rating!))!) : null, count: rated.length, stars },
    },
    team,
    revenue: {
      booked, bookings: bookedReqs.length, margin, margin_pct: pct(margin, booked), pipeline: pipelineReqs.reduce((s, r) => s + r.offer!.totals.price, 0), pipeline_count: pipelineReqs.length,
      avg_booking: bookedReqs.length ? Math.floor(booked / bookedReqs.length / 100 + 0.5) * 100 : null, quote_to_book_pct: pct(funnel[5].count, funnel[3].count),
      by_month, by_destination, funnel, lost_reasons,
    },
    voices,
    options: {
      destinations: [...new Map(all.map((r) => [r.input.destination ?? "other", destByCode(r.input.destination)?.name ?? "Other places"])).entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name)),
      salespeople: [...new Map(all.filter((r) => r.assignee).map((r) => [r.assignee!.id, r.assignee!.name])).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    },
  };
  report.briefing = briefing(scoped, report, now);
  return report;
}

/** One plain verdict and up to four bullets. Booking change compares the last 30 days with the 30 days before. */
function briefing(scoped: TravelRequest[], rep: OwnerReport, now: string) {
  const t = +new Date(now);
  const inWin = (r: TravelRequest, a: number, b: number) => { const at = bookedAt(r); return !!at && r.status === "booked" && +new Date(at) > t - a * DAY && +new Date(at) <= t - b * DAY; };
  const cur = scoped.filter((r) => inWin(r, 30, 0)), prev = scoped.filter((r) => inWin(r, 60, 30));
  const sum = (rs: TravelRequest[]) => rs.reduce((s, r) => s + (r.offer?.totals.price ?? 0), 0);
  const bullets: string[] = [];
  if (prev.length && cur.length) {
    const ch = Math.round(((sum(cur) - sum(prev)) / sum(prev)) * 100);
    bullets.push(`Bookings ${ch >= 0 ? "up" : "down"} ${Math.abs(ch)}% in the last 30 days: ${peso(sum(cur))} from ${cur.length} trip${cur.length > 1 ? "s" : ""}.`);
  } else bullets.push(cur.length ? `${cur.length} trip${cur.length > 1 ? "s" : ""} booked in the last 30 days (${peso(sum(cur))}).` : "No trips booked in the last 30 days yet.");
  const top = [...groupBy(scoped.filter((r) => +new Date(r.created_at) > t - 90 * DAY), (r) => destByCode(r.input.destination)?.name ?? "Other places").entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  if (top.length) bullets.push(top.length > 1 ? `${top[0][0]} and ${top[1][0]} lead customer requests this quarter.` : `${top[0][0]} leads customer requests this quarter.`);
  const worst = rep.sentiment.themes.find((x) => x.negative > 0);
  if (worst) bullets.push(`Customers are unhappy about ${worst.label.toLowerCase()} on ${worst.requests} request${worst.requests > 1 ? "s" : ""}.`);
  const waiting = scoped.filter((r) => hoursWaiting(r, now) >= 24).length, pending = scoped.filter((r) => r.status === "pending_approval").length;
  if (waiting || pending) bullets.push([waiting ? `${waiting} request${waiting > 1 ? "s have" : " has"} waited over 24 hours` : "", pending ? `${pending} offer${pending > 1 ? "s wait" : " waits"} for approval` : ""].filter(Boolean).join("; ") + ".");
  const s = rep.sentiment;
  const about = worst ? `, mainly about ${worst.label.toLowerCase()}` : "";
  const verdict = !s.total ? "Not enough customer messages yet to read the mood."
    : s.negative > s.positive ? `More customers are unhappy than happy right now${about}. Fix that first.`
    : s.positive >= 2 * s.negative ? `Customers are mostly happy: ${s.positive} happy messages and ${s.negative} unhappy${worst ? `, mostly about ${worst.label.toLowerCase()}` : ""}.`
    : `Customer mood is mixed: ${s.positive} happy and ${s.negative} unhappy messages${about}.`;
  return { verdict, bullets: bullets.slice(0, 4) };
}

/** CSV of every customer message with its sentiment (opens in Excel). */
export function voicesCsv(vs: Voice[]): string {
  const esc = (x: unknown) => { const s = String(x ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ["Date", "Reference", "Customer", "Destination", "Salesperson", "Stage", "Type", "Message", "Mood", "Score", "Theme", "Stars", "Sample"];
  return [head, ...vs.map((v) => [v.at.slice(0, 10), v.ref, v.customer, v.destination_name, v.salesperson, STATUSES[v.status].staff, v.kind_label, v.text, v.mood, v.score, v.theme_label, v.rating ?? "", v.is_sample ? "yes" : ""])]
    .map((row) => row.map(esc).join(",")).join("\r\n");
}
