// PAPH AI Quotation Analyst: free, rule-based and fully deterministic (same inputs = same numbers).
// Port twin: backend/app/quotes/engine.py. Both read the same catalog.json and are checked by the same
// test cases (quote_cases.json): `npm run test:engine` and backend `pytest`.
import CATALOG from "./catalog.json";

export type Tier = "budget" | "mid" | "luxury";
export interface TripInput {
  destination: string | null; place_text: string | null; days: number; adults: number; kids: number; tier: Tier | null;
  budget: number | null; budget_per_person: boolean; month: number | null; travel_date: string | null; interests: string[];
}
export interface Parsed {
  destination: string | null; place_text: string | null; days: number | null; adults: number | null; kids: number | null; tier: Tier | null;
  budget: number | null; budget_per_person: boolean; month: number | null; travel_date: string | null; interests: string[]; understood: string[];
}
export interface Line { kind: string; label: string; detail: string; low: number; high: number }
export interface Tour { name: string; price: number[]; tags: string[] }
export interface Day { day: number; title: string; text: string }
export interface OptionQuote {
  code: string; label: string; tier: Tier; tier_label: string; blurb: string; lines: Line[]; subtotal_low: number; subtotal_high: number;
  total_low: number; total_high: number; pp_low: number; pp_high: number; fit: "fits" | "tight" | "over" | null; recommended: boolean;
  hotel: { area: string; why: string; stay: string; rooms: number; nights: number; rate: number[] }; tours: string[]; itinerary: Day[];
}
export interface FitIdea { kind: "tier" | "days" | "month" | "destination"; title: string; detail: string; destination: string; tier: Tier; days: number; month: number | null; total_low: number; total_high: number; diff: number; fits: boolean }
export interface BudgetCheck { budget_total: number; status: "fits" | "tight" | "over"; message: string; shortfall: number; ideas: FitIdea[]; best: FitIdea | null }
export interface Addon { code: string; label: string; detail: string; unit: string; cost: number; price: number }
export interface Visa { needed: boolean; label: string; note: string; docs: string[]; fee: number[] }
export interface Recommendation {
  kind: "priced" | "manual"; input: TripInput; destination: { code: string; name: string; country: string; region: string; domestic: boolean } | null;
  season: { kind: "peak" | "low" | "regular"; label: string; month: number | null }; assumptions: string[]; options: OptionQuote[]; recommended: string | null;
  verdict: string; budget: BudgetCheck | null; visa: Visa | null; addons: Addon[]; notice: string; version: string;
}

type Dest = (typeof CATALOG.destinations)[number];
export type Rules = typeof CATALOG.rules;
export const catalog = CATALOG;
export const RULES: Rules = CATALOG.rules;
export const TIERS = CATALOG.tiers as Record<Tier, { label: string; hotel: string }>;
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ---------- small helpers (identical rounding in Python: floor(x / 100 + 0.5) * 100) ----------
export const r100 = (x: number) => Math.floor(x / 100 + 0.5) * 100;
const rint = (x: number) => Math.floor(x + 0.5);
export const peso = (n: number) => (n < 0 ? "-" : "") + "₱" + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const destByCode = (code: string | null) => CATALOG.destinations.find((d) => d.code === code) ?? null;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
export const paxText = (a: number, k: number) => [plural(a, "adult"), k ? (k === 1 ? "1 child" : `${k} children`) : ""].filter(Boolean).join(" and ");

// ---------- 1. Understand the request (English, Tagalog, Taglish) ----------
const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14, fifteen: 15, twenty: 20,
  isa: 1, isang: 1, dalawa: 2, dalawang: 2, tatlo: 3, tatlong: 3, apat: 4, lima: 5, limang: 5, anim: 6, pito: 7, pitong: 7, walo: 8, walong: 8, siyam: 9, sampu: 10, sampung: 10, a: 1,
};
const NUM = "(\\d+|" + Object.keys(NUM_WORDS).join("|") + ")";
const toNum = (s: string) => (/^\d+$/.test(s) ? parseInt(s, 10) : NUM_WORDS[s] ?? NaN);
const MONTH_RE: [RegExp, number][] = [
  [/\b(jan|january|enero)\b/, 1], [/\b(feb|february|pebrero)\b/, 2], [/\b(mar|march|marso)\b/, 3], [/\b(apr|april|abril)\b/, 4],
  [/\b(may\s+\d{1,2}|(in|this|next|ngayong|sa buwan ng)\s+may|may\s+20\d\d|mayo)\b/, 5], [/\b(jun|june|hunyo)\b/, 6], [/\b(jul|july|hulyo)\b/, 7],
  [/\b(aug|august|agosto)\b/, 8], [/\b(sep|sept|september|setyembre)\b/, 9], [/\b(oct|october|oktubre)\b/, 10], [/\b(nov|november|nobyembre)\b/, 11],
  [/\b(dec|december|disyembre)\b/, 12], [/\b(christmas|pasko|xmas)\b/, 12], [/\b(new year|bagong taon)\b/, 1],
  [/\b(holy week|semana santa|mahal na araw|summer|tag-init)\b/, 4],
];
const MONTH_NAMES = "jan|january|enero|feb|february|pebrero|mar|march|marso|apr|april|abril|may|mayo|jun|june|hunyo|jul|july|hulyo|aug|august|agosto|sep|sept|september|setyembre|oct|october|oktubre|nov|november|nobyembre|dec|december|disyembre";
function monthOf(word: string): number | null {
  for (const [re, m] of MONTH_RE) if (re.test(word) || re.test(" in " + word + " ")) return m;
  return null;
}

/** Reads free text and fills in what it can. Anything not mentioned stays null so the customer can fill it in. */
export function parseRequest(raw: string, today: string): Parsed {
  const t = " " + raw.toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim() + " ";
  const out: Parsed = { destination: null, place_text: null, days: null, adults: null, kids: null, tier: null, budget: null, budget_per_person: false, month: null, travel_date: null, interests: [], understood: [] };

  // destination: earliest alias found in the text
  let best = Infinity;
  for (const d of CATALOG.destinations) for (const a of d.aliases) {
    const m = new RegExp("\\b" + a.replace(/ /g, "\\s") + "\\b").exec(t);
    if (m && m.index < best) { best = m.index; out.destination = d.code; }
  }
  if (!out.destination) {
    const m = /(?:pumunta|punta|go|travel|trip|fly|visit|tour)\s+(?:sa|to|in)?\s*([A-Z][\w'-]+(?:\s[A-Z][\w'-]+)?)/.exec(" " + raw + " ");
    if (m && !/^(I|Ako|Kami|We)$/.test(m[1])) out.place_text = m[1];
  }

  // dates like "Dec 20-28" or "December 20 to 28"
  const range = new RegExp(`\\b(${MONTH_NAMES})\\.?\\s*(\\d{1,2})\\s*(?:-|to|hanggang)\\s*(?:(${MONTH_NAMES})\\.?\\s*)?(\\d{1,2})\\b`).exec(t);
  if (range) {
    const m1 = monthOf(range[1])!, m2 = range[3] ? monthOf(range[3])! : m1;
    const d1 = parseInt(range[2], 10), d2 = parseInt(range[4], 10);
    const year = nextYearFor(m1, d1, today);
    const start = Date.UTC(year, m1 - 1, d1), end = Date.UTC(m2 < m1 ? year + 1 : year, m2 - 1, d2);
    if (end > start && d1 <= 31) {
      out.days = Math.round((end - start) / 86400000) + 1;
      out.month = m1;
      out.travel_date = new Date(start).toISOString().slice(0, 10);
    }
  }
  if (!out.travel_date) {
    const single = new RegExp(`\\b(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!\\s*(?:days?|nights?|araw|gabi|pax|adults?|kids?))`).exec(t);
    if (single && parseInt(single[2], 10) <= 31) {
      const m1 = monthOf(single[1])!, d1 = parseInt(single[2], 10);
      out.month = m1;
      out.travel_date = new Date(Date.UTC(nextYearFor(m1, d1, today), m1 - 1, d1)).toISOString().slice(0, 10);
    }
  }
  if (!out.month) for (const [re, m] of MONTH_RE) if (re.test(t)) { out.month = m; break; }

  // length of stay
  if (out.days === null) {
    let m = /\b(\d+)\s*d\s*(\d+)\s*n\b/.exec(t) || /\b(\d+)\s*n\s*(\d+)\s*d\b/.exec(t);
    if (m) { const a = parseInt(m[1], 10), b = parseInt(m[2], 10); out.days = Math.max(a, b); }
    else if ((m = new RegExp(`\\b${NUM}\\s*(?:-\\s*)?(?:nights?|gabi)\\b`).exec(t))) out.days = toNum(m[1]) + 1;
    else if ((m = new RegExp(`\\b${NUM}\\s*(?:-\\s*)?(?:days?|araw)\\b`).exec(t))) out.days = toNum(m[1]);
    else if ((m = new RegExp(`\\b${NUM}\\s*(?:-\\s*)?(?:weeks?|linggo)\\b`).exec(t))) out.days = toNum(m[1]) * 7;
  }

  // travellers
  let m: RegExpExecArray | null;
  if ((m = new RegExp(`\\b${NUM}\\s*(?:adults?|matanda)\\b`).exec(t))) out.adults = toNum(m[1]);
  if ((m = new RegExp(`\\b${NUM}\\s*(?:kids?|children|child|bata|anak|chikiting)\\b`).exec(t))) out.kids = toNum(m[1]);
  if ((m = /\bfamily of (\d+)\b/.exec(t)) && out.adults === null) { const n = parseInt(m[1], 10); out.adults = Math.min(2, n); out.kids = out.kids ?? Math.max(0, n - 2); }
  if ((m = new RegExp(`\\b${NUM}\\s*(?:pax|people|persons?|tao|katao|travell?ers?|guests?)\\b`).exec(t)) && out.adults === null) {
    const n = toNum(m[1]); out.adults = Math.max(1, n - (out.kids ?? 0));
  }
  if (out.adults === null) {
    if (/\b(couple|honeymoon|mag-asawa|mag asawa|asawa ko|my (wife|husband|partner|boyfriend|girlfriend)|jowa|kami ni|kaming dalawa)\b/.test(t)) out.adults = 2;
    else if (/\b(solo|ako lang|mag-isa|mag isa|alone|just me|by myself)\b/.test(t)) out.adults = 1;
    else if (/\b(kami|we|us|namin|our|tayo)\b/.test(t)) out.adults = 2;
    else if (/\b(ako|ko|i|me|my)\b/.test(t) && !/\b(family|pamilya|barkada|friends)\b/.test(t)) out.adults = 1;
  }

  // hotel level ("budget" alone usually means an amount, so only clear phrases count)
  if (/\b(5|five)[\s-]?stars?\b|5\*|\b(luxury|luxurious|sosyal|premium|high[\s-]?end|bongga)\b/.test(t)) out.tier = "luxury";
  else if (/\b(4|four)[\s-]?stars?\b|\b(mid[\s-]?range|midrange|mid|sakto lang|comfortable)\b/.test(t)) out.tier = "mid";
  else if (/\b(budget[\s-]?friendly|budget lang|budget hotel|budget trip|on a budget|cheap|cheapest|tipid|mura|pinakamura|affordable|hostel|low[\s-]?cost|(3|three)[\s-]?stars?)\b/.test(t)) out.tier = "budget";

  // budget amount
  const money = /(?<![a-z])(?:₱|php|p)\s?(\d[\d,]*(?:\.\d+)?)\s*(k|m)?\b|\b(\d[\d,]*(?:\.\d+)?)\s*(k|m|thousand|million|libo|pesos?|php)\b/.exec(t);
  if (money) {
    const n = parseFloat((money[1] ?? money[3]).replace(/,/g, ""));
    const unit = money[2] ?? money[4] ?? "";
    const mult = unit === "k" || unit === "thousand" || unit === "libo" ? 1000 : unit === "m" || unit === "million" ? 1000000 : 1;
    const amount = rint(n * mult);
    if (amount >= 1000) {
      out.budget = amount;
      out.budget_per_person = /\b(per (person|pax|head|tao)|each|bawat isa|kada (isa|tao)|isang tao)\b|\/\s?(pax|person|head)/.test(t);
    }
  }

  // interests
  for (const [k, words] of Object.entries(CATALOG.interests)) if (words.some((w) => new RegExp("\\b" + w + "\\b").test(t))) out.interests.push(k);

  out.understood = describe(out);
  return out;
}

function nextYearFor(month: number, day: number, today: string): number {
  const y = parseInt(today.slice(0, 4), 10);
  return Date.UTC(y, month - 1, day) >= Date.parse(today.slice(0, 10)) ? y : y + 1;
}

function describe(p: Parsed): string[] {
  const u: string[] = [];
  const d = destByCode(p.destination);
  if (d) u.push(`Going to ${d.name}`); else if (p.place_text) u.push(`Going to ${p.place_text} (no sample rates yet)`);
  if (p.days) u.push(`${p.days} days, ${p.days - 1} nights`);
  if (p.travel_date) u.push(`Leaving ${fmtDay(p.travel_date)}`); else if (p.month) u.push(`Travelling in ${MONTHS[p.month - 1]}`);
  if (p.adults !== null || p.kids !== null) u.push(paxText(p.adults ?? 1, p.kids ?? 0));
  if (p.tier) u.push(`${TIERS[p.tier].label} hotel`);
  if (p.budget) u.push(`Budget ${peso(p.budget)}${p.budget_per_person ? " per person" : " in total"}`);
  if (p.interests.length) u.push("Likes " + p.interests.map((i) => i.replace("_", " ")).join(", "));
  return u;
}
export const fmtDay = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`; };

/** Fills gaps with safe defaults and says plainly what was assumed. */
export function normalize(p: Partial<Parsed>, rules: Rules = RULES): { input: TripInput; assumptions: string[] } {
  const a: string[] = [];
  let days = p.days ?? null;
  if (!days) { days = rules.default_days; a.push(`No trip length given, so we used ${days} days.`); }
  days = Math.min(rules.max_days, Math.max(rules.min_days, Math.floor(days)));
  let adults = p.adults ?? null;
  if (!adults || adults < 1) { adults = 1; a.push("Number of travellers not given, so we priced it for 1 adult."); }
  const kids = Math.max(0, Math.floor(p.kids ?? 0));
  let month = p.month ?? null;
  if (p.travel_date) month = parseInt(p.travel_date.slice(5, 7), 10);
  const interests = [...(p.interests ?? [])];
  if (kids > 0 && !interests.includes("family")) interests.push("family");
  if (!p.tier) a.push("No hotel level chosen, so we compared all three.");
  return {
    input: { destination: p.destination ?? null, place_text: p.place_text ?? null, days, adults: Math.floor(adults), kids, tier: p.tier ?? null,
      budget: p.budget && p.budget > 0 ? rint(p.budget) : null, budget_per_person: !!p.budget_per_person, month, travel_date: p.travel_date ?? null, interests },
    assumptions: a,
  };
}

// ---------- 2. Price it ----------
export function seasonOf(d: Dest, month: number | null, rules: Rules = RULES): Recommendation["season"] {
  if (!month) return { kind: "regular", label: "Regular season (no travel month given)", month: null };
  const ph = (rules.ph_peak as Record<string, string>)[String(month)];
  if (ph) return { kind: "peak", label: `Peak season: ${ph}`, month };
  if (d.peak_months.includes(month)) return { kind: "peak", label: `Peak season: busy month in ${d.name}`, month };
  if (d.low_months.includes(month)) return { kind: "low", label: `Off-peak: quieter month in ${d.name}`, month };
  return { kind: "regular", label: `Regular season (${MONTHS[month - 1]})`, month };
}

const score = (tags: string[], interests: string[]) => tags.filter((x) => interests.includes(x)).length;
function rank<T extends { tags: string[] }>(items: T[], interests: string[]): T[] {
  return items.map((x, i) => ({ x, i, s: score(x.tags, interests) })).sort((a, b) => b.s - a.s || a.i - b.i).map((o) => o.x);
}

export function priceOption(d: Dest, inp: TripInput, opt: (typeof CATALOG.options)[number], rules: Rules = RULES): OptionQuote {
  const tier = opt.tier as Tier;
  const { adults, kids, days } = inp;
  const pax = adults + kids, nights = days - 1;
  const rooms = Math.max(1, Math.ceil(adults / 2), Math.ceil(pax / 4));
  const lines: Line[] = [];
  const add = (kind: string, label: string, detail: string, lo: number, hi: number) => lines.push({ kind, label, detail, low: r100(lo), high: r100(hi) });
  const season = seasonOf(d, inp.month, rules);

  const fp = adults + kids * rules.kid_flight_factor;
  add("flight", "Flights", `${d.flight_note}, ${paxText(adults, kids)}${kids ? " (children about 25% less)" : ""}`, d.flight[0] * fp, d.flight[1] * fp);
  const h = d.hotels[tier];
  add("hotel", "Hotel", `${h.stay}, ${plural(nights, "night")} x ${plural(rooms, "room")}${kids ? ", kids share with parents" : ""}`, h.rate[0] * nights * rooms, h.rate[1] * nights * rooms);

  const nTours = days >= 3 ? Math.min(d.tours.length, Math.max(1, rint((days - 2) * opt.tour_share))) : 0;
  const tours = rank(d.tours, inp.interests).slice(0, nTours);
  if (tours.length) {
    const tp = adults + kids * rules.kid_tour_factor;
    add("tours", "Tours and activities", tours.map((x) => x.name).join("; ") + (kids ? " (children about half price)" : ""),
      tours.reduce((s, x) => s + x.price[0], 0) * tp, tours.reduce((s, x) => s + x.price[1], 0) * tp);
  }
  const vehicles = d.transfer_per_person ? pax : Math.ceil(pax / 4);
  const tf = opt.code === "premium" ? rules.premium_transfer_factor : 1;
  add("transfer", opt.code === "premium" ? "Private airport transfers" : "Airport transfers",
    d.transfer_per_person ? `Round trip, per person (boat, van and port fees)` : `Round trip, ${plural(vehicles, "vehicle")}`,
    d.transfer[0] * vehicles * tf, d.transfer[1] * vehicles * tf);
  const lp = adults + kids * rules.kid_local_factor;
  add("local", "Local transport", `${d.local_note}, ${plural(days, "day")}`, d.local[0] * days * lp, d.local[1] * days * lp);
  if (d.visa.fee[1] > 0) add("visa", d.visa.needed ? "Visa processing" : "Entry fees", `${d.visa.label}, ${plural(pax, "traveller")}`, d.visa.fee[0] * pax, d.visa.fee[1] * pax);
  if (d.insurance_required) {
    const ins = d.domestic ? rules.insurance_per_day.domestic : rules.insurance_per_day.international;
    add("insurance", "Travel insurance (required)", `Required for this visa, ${plural(days, "day")} x ${plural(pax, "traveller")}`, ins[0] * days * pax, ins[1] * days * pax);
  }
  const fl = lines.find((l) => l.kind === "flight")!, ht = lines.find((l) => l.kind === "hotel")!;
  if (season.kind === "peak") add("peak", "Peak-season surcharge", `${season.label.replace("Peak season: ", "")}: flights and hotels cost about ${rules.peak_surcharge_pct}% more`, (fl.low + ht.low) * rules.peak_surcharge_pct / 100, (fl.high + ht.high) * rules.peak_surcharge_pct / 100);
  if (season.kind === "low") add("offpeak", "Off-peak saving", `Quieter month: flights and hotels about ${rules.offpeak_saving_pct}% cheaper`, -(fl.low + ht.low) * rules.offpeak_saving_pct / 100, -(fl.high + ht.high) * rules.offpeak_saving_pct / 100);
  if (pax >= rules.group_size) {
    const tr = lines.find((l) => l.kind === "tours");
    add("group", "Group discount", `${pax} travellers: ${rules.group_discount_pct}% off hotel and tours`, -(ht.low + (tr?.low ?? 0)) * rules.group_discount_pct / 100, -(ht.high + (tr?.high ?? 0)) * rules.group_discount_pct / 100);
  }
  const sub_lo = lines.reduce((s, l) => s + l.low, 0), sub_hi = lines.reduce((s, l) => s + l.high, 0);
  const fee_lo = r100(Math.max(rules.service_fee_min, sub_lo * rules.service_fee_pct / 100)), fee_hi = r100(Math.max(rules.service_fee_min, sub_hi * rules.service_fee_pct / 100));
  lines.push({ kind: "fee", label: "PAPH service fee", detail: `Planning, booking and 24/7 trip support (${rules.service_fee_pct}%)`, low: fee_lo, high: fee_hi });
  const total_lo = sub_lo + fee_lo, total_hi = sub_hi + fee_hi;

  return {
    code: opt.code, label: opt.label, tier, tier_label: TIERS[tier].label, blurb: opt.blurb, lines, subtotal_low: sub_lo, subtotal_high: sub_hi,
    total_low: total_lo, total_high: total_hi, pp_low: r100(total_lo / pax), pp_high: r100(total_hi / pax), fit: null, recommended: false,
    hotel: { area: h.area, why: h.why, stay: h.stay, rooms, nights, rate: h.rate }, tours: tours.map((x) => x.name),
    itinerary: itinerary(d, inp, h.area, tours, opt.code === "premium"),
  };
}

function itinerary(d: Dest, inp: TripInput, area: string, tours: Tour[], priv: boolean): Day[] {
  const days: Day[] = [{ day: 1, title: "Arrival", text: `Fly from Manila to ${d.name}. ${priv ? "Private car" : "Transfer"} to your hotel in ${area}, check in and rest. Easy walk around the area in the evening.` }];
  const middle = Math.max(0, inp.days - 2);
  const slots: (Tour | null)[] = Array(middle).fill(null);
  tours.forEach((t, j) => { slots[Math.floor((j * middle) / tours.length)] = t; });
  const ideas = rank(d.ideas, inp.interests);
  let k = 0;
  slots.forEach((t, i) => {
    if (t) days.push({ day: i + 2, title: t.name, text: `${t.name}, with a guide and entrance fees. The rest of the day is free.` });
    else if (k < ideas.length) { const idea = ideas[k++]; days.push({ day: i + 2, title: "Free day", text: idea.text + "." }); }
    else days.push({ day: i + 2, title: "Free day", text: "Explore at your own pace, or add an extra tour." });
  });
  if (inp.days >= 2) days.push({ day: inp.days, title: "Going home", text: "Free morning for last-minute shopping, check out, transfer to the airport and fly home to Manila." });
  return days;
}

function budgetTotal(inp: TripInput) { return inp.budget === null ? null : inp.budget_per_person ? inp.budget * (inp.adults + inp.kids) : inp.budget; }
const fitOf = (o: OptionQuote, b: number): "fits" | "tight" | "over" => (b >= o.total_high ? "fits" : b >= o.total_low ? "tight" : "over");
const optionFor = (tier: Tier) => CATALOG.options.find((o) => o.tier === tier)!;

/** The full AI recommendation: 3 options, the best match, a budget check with nearest fits, visa notes and add-ons. */
export function recommend(inputOrParsed: Partial<Parsed>, rules: Rules = RULES): Recommendation {
  const { input, assumptions } = normalize(inputOrParsed, rules);
  const d = destByCode(input.destination);
  const base = { input, assumptions, notice: CATALOG.notice, version: CATALOG.version };
  if (!d) {
    const where = input.place_text ? `${input.place_text}` : "";
    return {
      ...base, kind: "manual", destination: null, season: { kind: "regular", label: "", month: input.month }, options: [], recommended: null, budget: null, visa: null, addons: [],
      verdict: where ? `We don't have sample rates for ${where} yet, so a PAPH travel consultant will price this trip for you.` : "Tell us where you would like to go, and a PAPH travel consultant will price the trip for you.",
    };
  }
  const season = seasonOf(d, input.month, rules);
  if (input.days < d.min_days) assumptions.push(`${d.name} is best with at least ${d.min_days} days; ${input.days} days will feel rushed.`);
  const options = CATALOG.options.map((o) => priceOption(d, input, o, rules));
  const B = budgetTotal(input);
  let rec: OptionQuote;
  if (input.tier) rec = options.find((o) => o.tier === input.tier)!;
  else if (B !== null) rec = [...options].reverse().find((o) => o.total_low <= B) ?? options[0];
  else rec = options.find((o) => o.code === "value")!;
  rec.recommended = true;
  if (B !== null) options.forEach((o) => { o.fit = fitOf(o, B); });

  const head = `${d.name}, ${input.days} days, ${rec.tier_label.toLowerCase()} hotel: about ${peso(rec.pp_low)} to ${peso(rec.pp_high)} per person`;
  let verdict = input.adults + input.kids > 1 ? `${head} (${peso(rec.total_low)} to ${peso(rec.total_high)} for ${paxText(input.adults, input.kids)}).` : `${head}.`;
  let budget: BudgetCheck | null = null;
  if (B !== null) budget = checkBudget(d, input, options, rec, B, rules);
  if (budget?.status === "over") verdict = budget.message;
  else if (budget?.status === "tight") verdict = `${head}. Your ${peso(B!)} budget fits the lower end of the range.`;
  else if (budget?.status === "fits") verdict = `${head}. This fits your ${peso(B!)} budget.`;

  return {
    ...base, kind: "priced", destination: { code: d.code, name: d.name, country: d.country, region: d.region, domestic: d.domestic }, season, options, recommended: rec.code,
    verdict, budget, visa: { needed: d.visa.needed, label: d.visa.label, note: d.visa.note, docs: d.visa.docs, fee: d.visa.fee }, addons: addonsFor(d, input, rec, rules),
  };
}

function checkBudget(d: Dest, inp: TripInput, options: OptionQuote[], rec: OptionQuote, B: number, rules: Rules): BudgetCheck {
  const status = fitOf(rec, B);
  const cheapest = options[0];
  if (status !== "over") {
    const msg = status === "fits" ? `Your ${peso(B)} budget covers this option with about ${peso(B - rec.total_high)} to spare.` : `Your ${peso(B)} budget fits the lower end of this range.`;
    return { budget_total: B, status, message: msg, shortfall: 0, ideas: [], best: null };
  }
  const ideas: FitIdea[] = [];
  const mk = (kind: FitIdea["kind"], title: string, detail: string, dest: Dest, tier: Tier, days: number, month: number | null): FitIdea => {
    const q = priceOption(dest, { ...inp, destination: dest.code, days, month, travel_date: month === inp.month ? inp.travel_date : null }, optionFor(tier), rules);
    return { kind, title, detail, destination: dest.code, tier, days, month, total_low: q.total_low, total_high: q.total_high, diff: B - q.total_low, fits: q.total_low <= B };
  };
  // a) lower hotel level, same trip
  const lower = options.filter((o) => o.total_low < rec.total_low).reverse();
  const tierFit = lower.find((o) => o.total_low <= B);
  if (tierFit) ideas.push(mk("tier", `${tierFit.label} hotel instead`, `${d.name} for ${inp.days} days with a ${tierFit.tier_label.toLowerCase()} hotel.`, d, tierFit.tier, inp.days, inp.month));
  // b) fewer days (your hotel level first, then budget)
  const minD = Math.max(rules.min_days, Math.min(d.min_days, inp.days - 1));
  for (const tier of Array.from(new Set([rec.tier, "budget" as Tier]))) {
    let found: FitIdea | null = null;
    for (let n = inp.days - 1; n >= minD; n--) { const f = mk("days", `${n} days instead of ${inp.days}`, `${d.name} for ${n} days with a ${TIERS[tier].label.toLowerCase()} hotel.`, d, tier, n, inp.month); if (f.fits) { found = f; break; } }
    if (found) { ideas.push(found); break; }
  }
  // c) a quieter month
  const season = seasonOf(d, inp.month, rules);
  if (season.kind !== "low" && d.low_months.length) {
    const lm = d.low_months[0];
    for (const tier of Array.from(new Set([rec.tier, "budget" as Tier]))) {
      const f = mk("month", `Travel in ${MONTHS[lm - 1]} instead`, `${d.name} in ${MONTHS[lm - 1]} (off-peak) for ${inp.days} days with a ${TIERS[tier].label.toLowerCase()} hotel.`, d, tier, inp.days, lm);
      if (f.fits || tier === "budget") { ideas.push(f); break; }
    }
  }
  // d) a cheaper destination: same number of days first, then fewer (down to that place's shortest sensible trip)
  const alts: FitIdea[] = [];
  for (const a of d.alternatives.map((c) => destByCode(c)!).filter(Boolean)) {
    for (let n = inp.days; n >= Math.max(rules.min_days, Math.min(a.min_days, inp.days)); n--) {
      const f = mk("destination", `${a.name} instead`, `${a.name} for ${n} days with a budget hotel.`, a, "budget", n, inp.month);
      if (f.fits) { alts.push(f); break; }
    }
  }
  // longest trip first, then the one that uses the budget best; keep two
  alts.sort((x, y) => y.days - x.days || x.diff - y.diff);
  ideas.push(...alts.slice(0, 2));
  const best = ideas.find((i) => i.fits) ?? null;
  const shortfall = cheapest.total_low - B;
  const short = `Your ${peso(B)} budget is ${peso(rec.total_low - B)} short of the lowest price for ${d.name}, ${inp.days} days, ${rec.tier_label.toLowerCase()} hotel (${peso(rec.total_low)}).`;
  const message = best
    ? `${short} Nearest fit: ${best.detail.replace(/\.$/, "")}, from ${peso(best.total_low)} (${peso(best.diff)} under your budget).`
    : `${short} Even the simplest version needs at least ${peso(cheapest.total_low)}, so you would need ${peso(Math.max(0, shortfall))} more.`;
  return { budget_total: B, status, message, shortfall: Math.max(0, shortfall), ideas, best };
}

function addonsFor(d: Dest, inp: TripInput, rec: OptionQuote, rules: Rules): Addon[] {
  const pax = inp.adults + inp.kids, out: Addon[] = [];
  const cat = Object.fromEntries(CATALOG.addons.map((a) => [a.code, a]));
  if (!d.insurance_required) {
    const ins = d.domestic ? rules.insurance_per_day.domestic : rules.insurance_per_day.international;
    out.push({ code: "insurance", label: cat.insurance.label, detail: cat.insurance.detail, unit: `${plural(pax, "traveller")}, ${plural(inp.days, "day")}`, cost: r100(ins[0] * inp.days * pax), price: r100(ins[1] * inp.days * pax) });
  }
  if (rec.code !== "premium" && !d.transfer_per_person) out.push({ code: "private_transfer", label: cat.private_transfer.label, detail: cat.private_transfer.detail, unit: "per booking", cost: cat.private_transfer.cost![0], price: cat.private_transfer.price! });
  if (!d.domestic) out.push({ code: "wifi", label: cat.wifi.label, detail: cat.wifi.detail, unit: plural(inp.days, "day"), cost: r100(cat.wifi.cost![0] * inp.days), price: r100(cat.wifi.price! * inp.days) });
  const tp = inp.adults + inp.kids * rules.kid_tour_factor;
  d.tours.forEach((t, i) => {
    if (rec.tours.includes(t.name)) return;
    out.push({ code: `tour:${i}`, label: `Extra tour: ${t.name}`, detail: "Guided, with entrance fees.", unit: plural(pax, "traveller"), cost: r100((t.price[0] + t.price[1]) / 2 * tp), price: r100(t.price[1] * tp) });
  });
  return out;
}
