// Builds ~6 months of SAMPLE past requests (closed: booked, lost or declined) by walking each one through the
// real workflow, so the owner dashboards have realistic history. Deterministic for a given `now`.
// Port twin: backend/app/quotes/history.py (same seed, same random sequence).
import H from "./sample_history.json";
import { parseRequest } from "./engine";
import { ActionCode, ActionPayload, Actor, Settings, TravelRequest, apply, createRequest } from "./workflow";

/** mulberry32: small seeded random generator (same numbers in Python). */
export function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const HOUR = 3600000;
const FEEDBACK_WEIGHTS = [3, 3, 3, 2, 2, 2, 1, 1, 1, 1, 1];
const LOST_WEIGHTS: [string, number][] = [["price", 40], ["dates", 20], ["other_agency", 15], ["no_response", 20], ["plans_changed", 5]];

export function generateHistory(now: string, people: { sales: [Actor, Actor]; agent: Actor }, firstSeq: number, settings: Settings): TravelRequest[] {
  const r = rng(H.seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const pickW = <T,>(xs: [T, number][]) => { let x = r() * xs.reduce((s, [, w]) => s + w, 0); for (const [v, w] of xs) { x -= w; if (x < 0) return v; } return xs[xs.length - 1][0]; };
  const end = +new Date(now);
  const out: TravelRequest[] = [];
  for (let i = 0; i < H.count; i++) {
    // denser toward today, like a growing business; the newest is 16 days old (the live sample queue covers the rest)
    const ageDays = 16 + (H.days - 16) * Math.pow(1 - i / H.count, 1.5);
    let t = end - ageDays * 24 * HOUR - Math.floor(r() * 10) * HOUR;
    const at = () => new Date(t).toISOString();
    const text = pick(H.requests), customer = pick(H.customers);
    const fast = r() < 0.58;
    const sales = fast ? people.sales[0] : people.sales[1], agent = people.agent;
    let req = createRequest({ id: `hist-${i + 1}`, seq: firstSeq + i, now: at(), customer: { name: customer, contact: `0917 555 ${2000 + i}` }, raw_text: text, input: parseRequest(text, at()), addons: [], is_sample: true }, settings);
    const cust: Actor = { id: "customer", name: req.customer.name, role: "CUSTOMER" };
    const step = (hours: number, action: ActionCode, who: Actor, payload: ActionPayload = {}) => { t += hours * HOUR; req = apply(req, action, who, payload, at(), settings); };
    const outcome = r();
    step(fast ? 1 + r() * 4 : 6 + r() * 22, "start_offer", sales);
    if (r() < 0.3) { step(2, "customer_question", cust, { note: pick(H.questions) }); step(fast ? 1 : 9, "answer", sales, { note: "Answered by phone." }); }
    if (r() < 0.5) step(0.5, "save_offer", sales, { discount: Math.floor((req.offer!.totals.margin * r() * 0.5) / 100) * 100 });
    step(1, "submit", sales);
    if (outcome >= 0.88) { step(5, "decline", agent, { note: "Partner hotels are full on those dates. Offer another month." }); out.push(req); continue; }
    if (r() < 0.2) {
      step(4, "request_changes", agent, { note: "Please use a lower hotel level to fit their budget." });
      step(3, "save_offer", sales, { discount: 0 });
      step(0.5, "submit", sales);
    }
    step(4, "approve", agent, req.offer!.totals.low_margin ? { note: "Repeat customer, small margin is okay." } : {});
    step(1, "send", sales);
    if (outcome < 0.5) {
      if (r() < 0.25) step(10, "customer_question", cust, { note: pick(H.questions) }), step(fast ? 1 : 12, "answer", sales, { note: "Replied with the details." });
      step(20, "customer_accept", cust);
      step(30, "mark_booked", sales);
      const tripEnd = t + (14 + req.input.days) * 24 * HOUR;
      if (tripEnd + 48 * HOUR < end && r() < 0.8) {
        const idx = pickW(FEEDBACK_WEIGHTS.map((w, k) => [k, w] as [number, number]));
        const [rating, note] = H.feedback[idx] as [number, string];
        t = tripEnd + 48 * HOUR;
        req = apply(req, "customer_feedback", cust, { rating, note }, at(), settings);
      }
    } else {
      if (r() < 0.35) step(18, "customer_changes", cust, { note: pick(H.changes) });
      const reason = pickW(LOST_WEIGHTS);
      step(48, "mark_lost", sales, { reason, note: pick((H.lost_notes as Record<string, string[]>)[reason]) });
    }
    out.push(req);
  }
  return out;
}
