// Checks the TypeScript quote engine and workflow against the shared cases in backend/tests/quote_cases.json.
// The Python engine (backend/app/quotes) must produce the exact same "golden" numbers.
// `node scripts/quote-test.mjs --update` rewrites the golden numbers after an intended pricing change.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "paph-"));
const out = join(dir, "quote.mjs");
await build({ stdin: { contents: "export * from './src/quote/engine.ts'; export * from './src/quote/workflow.ts';", resolveDir: process.cwd(), loader: "ts" }, bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "silent" });
const Q = await import(pathToFileURL(out).href);
const CASES_PATH = "../backend/tests/quote_cases.json";
const cases = JSON.parse(readFileSync(CASES_PATH, "utf8"));
let fail = 0;
const check = (ok, msg) => { if (!ok) { fail++; console.log("FAIL", msg); } };

// 1. understanding free text
for (const c of cases.parse) {
  const p = Q.parseRequest(c.text, cases.today);
  for (const [k, v] of Object.entries(c.expect)) check(JSON.stringify(p[k]) === JSON.stringify(v), `${k}: got ${JSON.stringify(p[k])} expected ${JSON.stringify(v)} | ${c.text}`);
}

// 2. golden numbers (same in Python)
const summary = (r) => ({
  kind: r.kind, recommended: r.recommended, season: r.season.kind, verdict: r.verdict,
  options: r.options.map((o) => ({ code: o.code, lines: o.lines.map((l) => [l.kind, l.low, l.high]), total: [o.total_low, o.total_high], pp: [o.pp_low, o.pp_high], tours: o.tours, days: o.itinerary.length, fit: o.fit })),
  budget: r.budget && { status: r.budget.status, shortfall: r.budget.shortfall, best: r.budget.best && [r.budget.best.kind, r.budget.best.destination, r.budget.best.tier, r.budget.best.days, r.budget.best.total_low], ideas: r.budget.ideas.map((i) => [i.kind, i.destination, i.tier, i.days, i.month, i.total_low, i.fits]) },
  addons: r.addons.map((a) => [a.code, a.cost, a.price]),
});
const update = process.argv.includes("--update");
for (const c of cases.recommend) {
  const got = summary(Q.recommend(c.input));
  if (update) cases.golden[c.name] = got;
  else check(JSON.stringify(got) === JSON.stringify(cases.golden[c.name]), `golden mismatch: ${c.name}\n got ${JSON.stringify(got)}\n exp ${JSON.stringify(cases.golden[c.name])}`);
}
if (update) writeFileSync(CASES_PATH, JSON.stringify(cases, null, 2) + "\n");

// 3. showcase rules
const lux = Q.recommend({ destination: "london", days: 10, adults: 1, tier: "luxury" });
check(lux.recommended === "premium" && lux.options.length === 3, "London 5-star should recommend the Premium option");
const cheap = Q.recommend({ destination: "london", days: 10, adults: 1, tier: "budget", budget: 80000 });
check(cheap.budget.status === "over" && cheap.budget.best && cheap.budget.best.total_low <= 80000, "London on 80k must be too low with a fitting nearest option");
check(Q.recommend({ destination: "london", days: 10, adults: 1 }).verdict === Q.recommend({ destination: "london", days: 10, adults: 1 }).verdict, "deterministic");

// 4. workflow rules
const S = Q.DEFAULT_SETTINGS, T0 = "2026-11-27T02:00:00.000Z";
const sales = { id: "s1", name: "Sam Sales", role: "SALES" }, agent = { id: "a1", name: "Ana Agent", role: "AGENT" }, admin = { id: "o1", name: "Owner", role: "ADMIN" }, cust = { id: "c", name: "Customer", role: "CUSTOMER" };
const throws = (fn, msg) => { try { fn(); check(false, "expected an error: " + msg); } catch (e) { check(e instanceof Q.FlowError, msg + " -> " + e.message); } };
let r = Q.createRequest({ id: "x", seq: 1, now: T0, customer: { name: "Juan", contact: "0917 000 0000" }, raw_text: "London", input: { destination: "london", days: 10, adults: 1, tier: "luxury" }, addons: ["wifi"] }, S);
check(r.ref === "PAPH-2026-0001" && r.status === "ai_recommended" && r.events.length === 2, "create");
throws(() => Q.apply(r, "approve", agent, {}, T0, S), "agent cannot approve before an offer exists");
throws(() => Q.apply(r, "start_offer", agent, {}, T0, S), "agent cannot draft");
r = Q.apply(r, "start_offer", sales, {}, T0, S);
check(r.status === "offer_drafted" && r.offer.lines.some((l) => l.kind === "addon") && r.offer.totals.ai_check === "inside", "offer from AI option is inside the AI range: " + JSON.stringify(r.offer?.totals));
throws(() => Q.apply(r, "approve", sales, {}, T0, S), "sales cannot approve");
const tooCheap = Q.apply(r, "save_offer", sales, { discount: r.offer.totals.margin + 5000 }, T0, S);
check(tooCheap.offer.totals.below_cost, "big discount is below cost");
throws(() => Q.apply(tooCheap, "submit", sales, {}, T0, S), "below cost cannot be sent for approval");
const thin = Q.apply(r, "save_offer", sales, { discount: r.offer.totals.margin - Math.round(r.offer.totals.price * 0.03) }, T0, S);
check(thin.offer.totals.low_margin, "thin margin flagged");
let p = Q.apply(thin, "submit", sales, {}, T0, S);
throws(() => Q.apply(p, "approve", agent, {}, T0, S), "low margin needs a reason");
p = Q.apply(p, "approve", agent, { note: "Repeat customer" }, T0, S);
check(p.status === "approved" && p.approval.version === p.offer.version, "approve with reason");
r = Q.apply(r, "submit", admin, {}, T0, S);
throws(() => Q.apply(r, "approve", admin, {}, T0, S), "cannot approve own offer");
throws(() => Q.apply(r, "request_changes", agent, {}, T0, S), "ask for changes needs a note");
let ch = Q.apply(r, "request_changes", agent, { note: "Use a cheaper hotel" }, T0, S);
check(ch.status === "changes_requested", "changes requested");
ch = Q.apply(ch, "save_offer", sales, { discount: 1000 }, T0, S);
check(ch.status === "offer_drafted", "edit after changes -> drafted");
r = Q.apply(r, "approve", agent, {}, T0, S);
check(r.status === "approved", "approved");
const edited = Q.apply(r, "save_offer", sales, { discount: 2000 }, T0, S);
check(edited.status === "pending_approval" && edited.approval === null, "edit after approval goes back to approval");
const later = "2026-12-10T02:00:00.000Z";
check(Q.isExpired(r, later), "expired after 7 days");
throws(() => Q.apply(r, "customer_accept", cust, {}, later, S), "customer cannot accept an expired offer");
r = Q.apply(r, "send", sales, {}, T0, S);
r = Q.apply(r, "customer_question", cust, { note: "Is breakfast included?" }, T0, S);
check(r.customer_question && r.status === "sent", "question keeps status");
r = Q.apply(r, "answer", sales, { note: "Yes, daily breakfast" }, T0, S);
r = Q.apply(r, "customer_accept", cust, {}, T0, S);
throws(() => Q.apply(r, "mark_lost", sales, {}, T0, S), "lost needs a reason");
r = Q.apply(r, "mark_booked", sales, {}, T0, S);
check(r.status === "booked" && r.events.length === 10, "booked with full trail (" + r.events.length + " events)");
const terms = Q.quotationTerms(p, S, T0);
check(terms.deposit === Q.r100(p.offer.totals.price * 0.3) && terms.deposit + terms.balance === p.offer.totals.price, "payment schedule adds up");

console.log(fail ? `${fail} problem(s)` : `all quote engine and workflow checks pass (${cases.parse.length} parse cases, ${cases.recommend.length} golden quotes)`);
process.exit(fail ? 1 : 0);
