// Read-only views over requests: queue rows, the customer's tracking view and the dashboard.
// Port twin: backend/app/quotes/views.py.
import type { Dashboard, PublicView, RequestDetail, RequestSummary } from "../api/types";
import { destByCode, paxText } from "./engine";
import { ACTIONS, ActionCode, LOST_REASONS, Role, STATUSES, Settings, Status, TravelRequest, allowed, hoursWaiting, isExpired, quotationTerms } from "./workflow";

export const QUEUE: Status[] = ["new", "ai_recommended", "offer_drafted", "changes_requested"];
const QUOTED: Status[] = ["approved", "sent", "accepted", "booked"];

export function summary(r: TravelRequest, now: string): RequestSummary {
  const rec = r.recommendation, opt = rec.options.find((o) => o.code === (r.offer?.option ?? rec.recommended));
  const t = r.offer?.totals;
  return {
    id: r.id, ref: r.ref, created_at: r.created_at, updated_at: r.updated_at, status: r.status, is_sample: r.is_sample, customer_name: r.customer.name,
    destination_name: rec.destination?.name ?? r.input.place_text ?? "Not sure yet", days: r.input.days, pax: r.input.adults + r.input.kids,
    tier_label: opt?.tier_label ?? "", verdict: rec.verdict, assignee: r.assignee?.name ?? null,
    ai_low: opt?.total_low ?? null, ai_high: opt?.total_high ?? null, offer_price: t ? t.price : null, margin_pct: t ? t.margin_pct : null,
    flags: {
      waiting_hours: Math.floor(hoursWaiting(r, now)), expired: isExpired(r, now), question: !!r.customer_question,
      below_cost: !!t?.below_cost, low_margin: !!t?.low_margin, budget_too_low: rec.budget?.status === "over",
    },
  };
}

export function list(all: TravelRequest[], view: "queue" | "approval" | "open" | "closed" | "all", now: string): RequestSummary[] {
  const pick = all.filter((r) =>
    view === "queue" ? QUEUE.includes(r.status) || (!!r.customer_question && STATUSES[r.status].open)
      : view === "approval" ? r.status === "pending_approval"
      : view === "open" ? STATUSES[r.status].open
      : view === "closed" ? !STATUSES[r.status].open : true);
  const rows = pick.map((r) => summary(r, now));
  if (view === "queue" || view === "approval") return rows.sort((a, b) => b.flags.waiting_hours - a.flags.waiting_hours || a.created_at.localeCompare(b.created_at));
  return rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function detail(r: TravelRequest, role: Role, settings: Settings, now: string): RequestDetail {
  const showTerms = QUOTED.includes(r.status) && !!r.approval && !!r.offer;
  return { ...r, allowed: allowed(r, role), expired: isExpired(r, now), waiting_hours: Math.floor(hoursWaiting(r, now)), terms: showTerms ? quotationTerms(r, settings, now) : null };
}

const PUBLIC_EVENTS: Record<string, string> = {
  submitted: "Request received", ai_recommended: "AI estimate ready", start_offer: "A travel consultant is preparing your offer",
  approve: "Your offer is ready", send: "Quotation sent to you", customer_accept: "You accepted the offer", customer_changes: "You asked for changes",
  customer_question: "You asked a question", answer: "We answered your question", mark_booked: "Booked. See you on your trip!", mark_lost: "Request closed", decline: "Request closed",
};

/** Contact check for tracking: same email, or the same last 7 digits of a mobile number. */
export function contactMatches(saved: string, given: string): boolean {
  const a = saved.trim().toLowerCase(), b = given.trim().toLowerCase();
  if (!a || !b) return false;
  if (a.includes("@") || b.includes("@")) return a === b;
  const da = a.replace(/\D/g, ""), db = b.replace(/\D/g, "");
  return da.length >= 7 && db.length >= 7 && da.slice(-7) === db.slice(-7);
}

export function publicView(r: TravelRequest, settings: Settings, now: string): PublicView {
  const st = STATUSES[r.status];
  const quoted = QUOTED.includes(r.status) && !!r.offer && !!r.approval;
  const expired = isExpired(r, now);
  const can = allowed(r, "CUSTOMER").filter((a: ActionCode) => !(expired && (a === "customer_accept" || a === "customer_changes")));
  return {
    ref: r.ref, created_at: r.created_at, status: r.status, customer_status: expired ? "Offer expired: rates must be rechecked" : st.customer, step: st.step, customer_name: r.customer.name,
    input: r.input, recommendation: r.recommendation, addons: r.addons, expired, question: r.customer_question,
    offer: quoted ? { option: r.offer!.option, lines: r.offer!.lines.map((l) => ({ label: l.label, detail: l.detail, price: l.price })), discount: r.offer!.discount, total: r.offer!.totals.price, per_person: r.offer!.totals.per_person, notes: r.offer!.notes } : null,
    terms: quoted ? quotationTerms(r, settings, now) : null,
    timeline: r.events.filter((e) => PUBLIC_EVENTS[e.action]).map((e) => ({ at: e.at, label: PUBLIC_EVENTS[e.action] + (e.action === "answer" || e.action === "customer_question" ? `: ${e.note}` : "") })),
    can: can.filter((a) => ACTIONS[a].roles.includes("CUSTOMER")),
  };
}

export function dashboard(all: TravelRequest[], now: string): Dashboard {
  const count = (s: Status) => all.filter((r) => r.status === s).length;
  const booked = count("booked"), lost = count("lost"), declined = count("declined");
  const offered = all.filter((r) => r.events.some((e) => e.action === "approve")).length;
  const quotes = all.filter((r) => r.approval && r.offer).map((r) => r.offer!.totals.price);
  const dest: Record<string, { code: string; name: string; count: number }> = {};
  for (const r of all) { const d = destByCode(r.input.destination); const k = d?.code ?? "other"; dest[k] ??= { code: k, name: d?.name ?? "Other places", count: 0 }; dest[k].count++; }
  const reasons: Record<string, number> = {};
  for (const r of all) if (r.status === "lost" && r.lost_reason) reasons[r.lost_reason] = (reasons[r.lost_reason] ?? 0) + 1;
  return {
    total: all.length, open: all.filter((r) => STATUSES[r.status].open).length, booked, lost, declined,
    conversion_pct: offered ? Math.floor((booked / offered) * 1000 + 0.5) / 10 : null,
    avg_quote: quotes.length ? Math.floor(quotes.reduce((s, x) => s + x, 0) / quotes.length / 100 + 0.5) * 100 : null,
    pipeline_value: all.filter((r) => ["approved", "sent", "accepted"].includes(r.status) && r.offer).reduce((s, r) => s + r.offer!.totals.price, 0),
    by_status: (Object.keys(STATUSES) as Status[]).filter((s) => s !== "new").map((s) => ({ status: s, label: STATUSES[s].staff, count: count(s) })),
    top_destinations: Object.values(dest).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 6),
    lost_reasons: Object.entries(reasons).map(([reason, c]) => ({ reason, label: LOST_REASONS[reason], count: c })).sort((a, b) => b.count - a.count),
    awaiting_decision: list(all, "approval", now),
    waiting_long: all.filter((r) => hoursWaiting(r, now) >= 24).length,
    sample_count: all.filter((r) => r.is_sample).length,
  };
}
export { paxText };
