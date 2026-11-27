// Request -> AI recommendation -> sales offer -> agent decision -> quotation.
// Port twin: backend/app/quotes/workflow.py. Every rule lives here so the demo and the server behave the same.
import WF from "./workflow.json";
import { RULES, Rules, Recommendation, TripInput, destByCode, fmtDay, peso, r100, recommend, Parsed } from "./engine";

export type Role = "ADMIN" | "AGENT" | "SALES" | "CUSTOMER" | "SYSTEM";
export type Status = keyof typeof WF.statuses;
export type ActionCode = keyof typeof WF.actions;
export interface Actor { id: string; name: string; role: Role }
export interface OfferLine { id: string; kind: string; label: string; detail: string; cost: number; price: number }
export interface Totals {
  cost: number; price: number; discount: number; margin: number; margin_pct: number; below_cost: boolean; low_margin: boolean;
  ai_low: number; ai_high: number; ai_check: "inside" | "below" | "above" | "none"; ai_gap: number; per_person: number;
}
export interface Offer { option: string | null; lines: OfferLine[]; discount: number; notes: string; version: number; updated_by: string; updated_at: string; totals: Totals }
export interface RequestEvent { at: string; by: string; role: Role; action: string; from: Status | null; to: Status | null; note: string }
export interface TravelRequest {
  id: string; ref: string; created_at: string; updated_at: string; status: Status; is_sample: boolean;
  customer: { name: string; contact: string }; raw_text: string; input: TripInput; addons: string[];
  recommendation: Recommendation; assignee: { id: string; name: string } | null; offer: Offer | null;
  submitted_by: { id: string; name: string } | null; approval: { by: string; by_id: string; at: string; note: string; version: number; valid_until: string } | null;
  customer_question: { text: string; at: string } | null; lost_reason: string | null; events: RequestEvent[];
}
export interface Settings { service_fee_pct: number; min_margin_pct: number; validity_days: number; deposit_pct: number; balance_days_before: number }

export const STATUSES = WF.statuses as Record<Status, { staff: string; customer: string; step: number; open: boolean }>;
export const ACTIONS = WF.actions as Record<ActionCode, { label: string; from: Status[]; to: Status | null; roles: Role[]; note?: boolean; reason?: boolean }>;
export const LOST_REASONS = WF.lost_reasons as Record<string, string>;
export const ROLE_LABELS = WF.roles as Record<string, string>;
export const DEFAULT_SETTINGS: Settings = {
  service_fee_pct: RULES.service_fee_pct, min_margin_pct: RULES.min_margin_pct, validity_days: RULES.validity_days,
  deposit_pct: RULES.deposit_pct, balance_days_before: RULES.balance_days_before,
};
export const rulesFrom = (s: Settings): Rules => ({ ...RULES, service_fee_pct: s.service_fee_pct, min_margin_pct: s.min_margin_pct, validity_days: s.validity_days, deposit_pct: s.deposit_pct, balance_days_before: s.balance_days_before });

export class FlowError extends Error {}
const fail = (msg: string): never => { throw new FlowError(msg); };
const addDays = (iso: string, days: number) => new Date(+new Date(iso) + days * 86400000).toISOString();
const round1 = (x: number) => Math.floor(x * 10 + 0.5) / 10;

export const refFor = (year: number, seq: number) => `PAPH-${year}-${String(seq).padStart(4, "0")}`;

/** A customer sends a request: the AI recommendation is made right away. */
export function createRequest(p: { id: string; seq: number; now: string; customer: { name: string; contact: string }; raw_text: string; input: Partial<Parsed>; addons: string[]; is_sample?: boolean }, settings: Settings = DEFAULT_SETTINGS): TravelRequest {
  const name = p.customer.name.trim(), contact = p.customer.contact.trim();
  if (name.length < 2) fail("Please enter your name.");
  if (contact.length < 5) fail("Please enter a mobile number or email so we can send your offer.");
  const rec = recommend(p.input, rulesFrom(settings));
  const known = new Set(rec.addons.map((a) => a.code));
  const req: TravelRequest = {
    id: p.id, ref: refFor(parseInt(p.now.slice(0, 4), 10), p.seq), created_at: p.now, updated_at: p.now, status: "ai_recommended", is_sample: !!p.is_sample,
    customer: { name: name.slice(0, 120), contact: contact.slice(0, 160) }, raw_text: p.raw_text.slice(0, 2000), input: rec.input,
    addons: p.addons.filter((a) => known.has(a)), recommendation: rec, assignee: null, offer: null, submitted_by: null, approval: null,
    customer_question: null, lost_reason: null, events: [],
  };
  req.events.push({ at: p.now, by: req.customer.name, role: "CUSTOMER", action: "submitted", from: null, to: "new", note: "Request received." });
  req.events.push({ at: p.now, by: "PAPH AI", role: "SYSTEM", action: "ai_recommended", from: "new", to: "ai_recommended", note: rec.verdict });
  return req;
}

/** Offer lines from one AI option: each cost is the middle of the AI range; the service fee is the margin. */
export function offerFromOption(req: TravelRequest, option: string | null, settings: Settings, by: string, now: string): Offer {
  const rec = req.recommendation;
  const o = rec.options.find((x) => x.code === option) ?? null;
  const lines: OfferLine[] = [];
  let n = 1;
  if (o) for (const l of o.lines) {
    if (l.kind === "fee") continue;
    const mid = r100((l.low + l.high) / 2);
    lines.push({ id: `l${n++}`, kind: l.kind, label: l.label, detail: l.detail, cost: mid, price: mid });
  }
  for (const code of req.addons) {
    const a = rec.addons.find((x) => x.code === code);
    if (a) lines.push({ id: `l${n++}`, kind: "addon", label: a.label, detail: `${a.detail} (${a.unit})`, cost: a.cost, price: a.price });
  }
  if (lines.length) {
    const base = lines.filter((l) => l.kind !== "addon").reduce((s, l) => s + l.cost, 0);
    lines.push({ id: `l${n++}`, kind: "fee", label: "PAPH service fee", detail: `Planning, booking and 24/7 trip support (${settings.service_fee_pct}%)`, cost: 0, price: r100(Math.max(RULES.service_fee_min, base * settings.service_fee_pct / 100)) });
  }
  const offer: Offer = { option: o ? o.code : null, lines, discount: 0, notes: "", version: 1, updated_by: by, updated_at: now, totals: null as unknown as Totals };
  offer.totals = totals(req, offer, settings);
  return offer;
}

export function totals(req: TravelRequest, offer: Pick<Offer, "lines" | "discount" | "option">, settings: Settings): Totals {
  const cost = offer.lines.reduce((s, l) => s + l.cost, 0);
  const price = offer.lines.reduce((s, l) => s + l.price, 0) - offer.discount;
  const margin = price - cost;
  const margin_pct = price > 0 ? round1((margin / price) * 100) : 0;
  const o = req.recommendation.options.find((x) => x.code === offer.option);
  const addons = offer.lines.filter((l) => l.kind === "addon").reduce((s, l) => s + l.price, 0);
  const ai_low = o ? o.total_low + addons : 0, ai_high = o ? o.total_high + addons : 0;
  const ai_check = !o ? "none" : price < ai_low ? "below" : price > ai_high ? "above" : "inside";
  const pax = req.input.adults + req.input.kids;
  return {
    cost, price, discount: offer.discount, margin, margin_pct, below_cost: price < cost, low_margin: price >= cost && margin_pct < settings.min_margin_pct,
    ai_low, ai_high, ai_check, ai_gap: ai_check === "below" ? ai_low - price : ai_check === "above" ? price - ai_high : 0, per_person: r100(price / Math.max(1, pax)),
  };
}

export const isExpired = (req: TravelRequest, now: string) => (req.status === "approved" || req.status === "sent") && !!req.approval && now > req.approval.valid_until;
export const hoursWaiting = (req: TravelRequest, now: string) => {
  if (!["new", "ai_recommended", "changes_requested"].includes(req.status) && !req.customer_question) return 0;
  const since = req.customer_question?.at ?? [...req.events].reverse().find((e) => e.to === req.status)?.at ?? req.created_at;
  return Math.max(0, (+new Date(now) - +new Date(since)) / 3600000);
};

/** What this person may do on this request right now (used to show buttons). */
export function allowed(req: TravelRequest, role: Role): ActionCode[] {
  return (Object.keys(ACTIONS) as ActionCode[]).filter((a) => ACTIONS[a].roles.includes(role) && ACTIONS[a].from.includes(req.status));
}

export interface ActionPayload { note?: string; option?: string | null; lines?: OfferLine[]; discount?: number; notes?: string; assignee?: { id: string; name: string }; reason?: string }

/** Applies one step. Throws FlowError with a plain message when the step is not allowed. Returns a new request. */
export function apply(prev: TravelRequest, action: ActionCode, actor: Actor, payload: ActionPayload, now: string, settings: Settings = DEFAULT_SETTINGS): TravelRequest {
  const spec = ACTIONS[action] ?? fail("Unknown action.");
  if (!spec.roles.includes(actor.role) ) fail(`Your role can't ${spec.label.toLowerCase()}.`);
  if (!spec.from.includes(prev.status)) fail(`You can't ${spec.label.toLowerCase()} while the request is "${STATUSES[prev.status].staff}".`);
  const note = (payload.note ?? "").trim().slice(0, 1000);
  if (spec.note && !note) fail("Please write a short note.");
  const req: TravelRequest = JSON.parse(JSON.stringify(prev));
  let to: Status = spec.to ?? req.status;
  let eventNote = note;

  switch (action) {
    case "start_offer": {
      const opt = payload.option !== undefined ? payload.option : req.recommendation.recommended;
      if (opt && !req.recommendation.options.some((o) => o.code === opt)) fail("Pick one of the AI options.");
      req.offer = offerFromOption(req, opt, settings, actor.name, now);
      if (!req.assignee) req.assignee = { id: actor.id, name: actor.name };
      eventNote = opt ? `Started from the "${req.recommendation.options.find((o) => o.code === opt)!.label}" option.` : "Started a blank offer.";
      break;
    }
    case "save_offer": {
      if (!req.offer) fail("Start the offer first.");
      const lines = (payload.lines ?? req.offer!.lines).map((l, i) => {
        const label = String(l.label ?? "").trim();
        if (!label) fail(`Line ${i + 1} needs a name.`);
        if (!Number.isFinite(l.cost) || !Number.isFinite(l.price)) fail(`Line ${i + 1}: cost and price must be numbers.`);
        return { id: l.id || `l${i + 1}`, kind: l.kind || "other", label: label.slice(0, 120), detail: String(l.detail ?? "").slice(0, 300), cost: Math.round(l.cost), price: Math.round(l.price) };
      });
      const discount = Math.round(payload.discount ?? req.offer!.discount);
      if (discount < 0) fail("The discount can't be negative.");
      const option = payload.option !== undefined ? payload.option : req.offer!.option;
      req.offer = { option, lines, discount, notes: (payload.notes ?? req.offer!.notes).slice(0, 1000), version: req.offer!.version + 1, updated_by: actor.name, updated_at: now, totals: null as unknown as Totals };
      req.offer.totals = totals(req, req.offer, settings);
      if (prev.status === "approved" || prev.status === "sent") {
        // any change after approval must be approved again
        guardSubmit(req);
        to = "pending_approval";
        req.approval = null;
        req.submitted_by = { id: actor.id, name: actor.name };
        eventNote = `Offer changed after approval (now ${peso(req.offer.totals.price)}), so it goes back for approval.${note ? " " + note : ""}`;
      } else eventNote = `Offer saved: ${peso(req.offer.totals.price)}.${note ? " " + note : ""}`;
      break;
    }
    case "submit": {
      guardSubmit(req);
      req.submitted_by = { id: actor.id, name: actor.name };
      eventNote = `Sent for approval at ${peso(req.offer!.totals.price)} (margin ${req.offer!.totals.margin_pct}%).${note ? " " + note : ""}`;
      break;
    }
    case "approve": {
      const t = req.offer!.totals;
      if (req.submitted_by?.id === actor.id) fail("You prepared this offer, so someone else must approve it.");
      if (t.below_cost) fail(`This offer is ${peso(t.cost - t.price)} below cost. Ask for changes instead.`);
      if (t.low_margin && !note) fail(`The margin is only ${t.margin_pct}% (the minimum is ${settings.min_margin_pct}%). Write the reason for approving it.`);
      req.approval = { by: actor.name, by_id: actor.id, at: now, note, version: req.offer!.version, valid_until: addDays(now, settings.validity_days) };
      eventNote = `Approved at ${peso(t.price)}. Valid until ${fmtDay(req.approval.valid_until.slice(0, 10))}.${note ? " " + note : ""}`;
      break;
    }
    case "send":
      if (isExpired(req, now)) fail("This offer has expired. Recheck the rates and edit the offer so it can be approved again.");
      eventNote = note || "Quotation sent to the customer.";
      break;
    case "customer_accept":
      if (isExpired(req, now)) fail("This offer has expired. Please ask us to recheck the rates.");
      if (!req.approval || req.approval.version !== req.offer?.version) fail("This offer is being updated. Please check again later.");
      eventNote = note || "Customer accepted the offer.";
      break;
    case "customer_changes":
      req.customer_question = null;
      break;
    case "customer_question":
      req.customer_question = { text: note, at: now };
      break;
    case "answer":
      if (!req.customer_question) fail("There is no open question from the customer.");
      req.customer_question = null;
      break;
    case "assign": {
      const a = payload.assignee ?? fail("Choose a salesperson.");
      if (actor.role === "SALES" && a.id !== actor.id) fail("Salespeople can only take a request for themselves.");
      req.assignee = { id: a.id, name: a.name };
      eventNote = `Assigned to ${a.name}.`;
      break;
    }
    case "mark_lost": {
      const r = payload.reason ?? "";
      if (!LOST_REASONS[r]) fail("Choose why the request was lost.");
      req.lost_reason = r;
      eventNote = LOST_REASONS[r] + (note ? `. ${note}` : "");
      break;
    }
    default:
      break;
  }
  req.status = to;
  req.updated_at = now;
  req.events.push({ at: now, by: actor.name, role: actor.role, action, from: prev.status, to, note: eventNote });
  return req;
}

function guardSubmit(req: TravelRequest) {
  const o = req.offer ?? fail("Start the offer first.");
  if (!o.lines.length || o.totals.price <= 0) fail("Add at least one priced line before sending for approval.");
  if (o.totals.below_cost) fail(`The offer is ${peso(o.totals.cost - o.totals.price)} below cost. Raise the price or lower the discount first.`);
}

// ---------- the printed quotation ----------
export interface QuotationTerms {
  ref: string; issued: string; valid_until: string; expired: boolean; deposit: number; balance: number; balance_due: string;
  inclusions: string[]; exclusions: string[]; cancellation: string[]; checklist: string[]; visa_note: string;
}
export function quotationTerms(req: TravelRequest, settings: Settings, now: string): QuotationTerms {
  const o = req.offer!, a = req.approval!;
  const deposit = r100((o.totals.price * settings.deposit_pct) / 100);
  const d = destByCode(req.input.destination);
  let balance_due = `${settings.balance_days_before} days before departure`;
  if (req.input.travel_date) {
    const due = new Date(Date.parse(req.input.travel_date) - settings.balance_days_before * 86400000).toISOString().slice(0, 10);
    balance_due = `on or before ${fmtDay(due < now.slice(0, 10) ? now.slice(0, 10) : due)}`;
  }
  const kinds = new Set(o.lines.map((l) => l.kind));
  const exclusions = ["Meals not stated in the itinerary", "Personal expenses, tips and shopping", "Excess baggage and seat selection", "Anything not listed under inclusions"];
  if (!kinds.has("visa") && d?.visa.needed) exclusions.unshift("Visa fees (visa assistance can be added)");
  if (!kinds.has("insurance") && !o.lines.some((l) => l.label.toLowerCase().includes("insurance"))) exclusions.unshift("Travel insurance (recommended)");
  return {
    ref: req.ref, issued: a.at, valid_until: a.valid_until, expired: isExpired(req, now), deposit, balance: o.totals.price - deposit, balance_due,
    inclusions: o.lines.filter((l) => l.kind !== "fee" && l.price >= 0).map((l) => `${l.label}: ${l.detail}`),
    exclusions,
    cancellation: [
      `A ${settings.deposit_pct}% deposit confirms the booking. Flights and hotels are booked only after the deposit.`,
      "Deposits become non-refundable once tickets and hotels are issued; changes follow airline and hotel rules.",
      "If a visa is refused, refunds follow airline and hotel rules minus fees already paid.",
      "Sample terms: PAPH Travel and Tours will replace these with its official policy.",
    ],
    checklist: d ? d.visa.docs : [],
    visa_note: d ? `${d.visa.label}. ${d.visa.note} Always check the latest requirements before you apply.` : "",
  };
}
