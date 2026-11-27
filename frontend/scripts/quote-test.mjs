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
await build({ stdin: { contents: "export * from './src/quote/engine.ts'; export * from './src/quote/workflow.ts'; export * from './src/quote/history.ts'; export * from './src/quote/owner.ts'; export * from './src/quote/clock.ts'; export * from './src/quote/care.ts';", resolveDir: process.cwd(), loader: "ts" }, bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "silent" });
const Q = await import(pathToFileURL(out).href);
const CASES_PATH = "../backend/tests/quote_cases.json";
const cases = JSON.parse(readFileSync(CASES_PATH, "utf8"));
const cases_json = cases;
let fail = 0;
let cases_golden_out = null;
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
// 2b. sample history + owner report (same in Python: same seed, same workflow, same sentiment engine)
{
  const NOW = "2026-11-27T02:00:00.000Z";
  const A = (id, name, role) => ({ id, name, role });
  const hist = Q.generateHistory(NOW, { sales: [A("s1", "Demo Salesperson", "SALES"), A("s2", "Second Salesperson (sample)", "SALES")], agent: A("a1", "Demo Travel Agent", "AGENT") }, 1, Q.DEFAULT_SETTINGS);
  const rep = Q.ownerReport(hist, { range: "all", destination: "", salesperson: "" }, NOW);
  const rep90 = Q.ownerReport(hist, { range: "90", destination: "japan", salesperson: "s1" }, NOW);
  const got = {
    refs: [hist[0].ref, hist[hist.length - 1].ref], statuses: hist.map((r) => r.status).join(","), last_event: hist[hist.length - 1].events.map((e) => [e.action, e.at]),
    feedback: hist.filter((r) => r.feedback).map((r) => r.feedback.rating).join(""), briefing: rep.briefing,
    sentiment: [rep.sentiment.total, rep.sentiment.positive, rep.sentiment.neutral, rep.sentiment.negative, rep.sentiment.avg_score, rep.sentiment.ratings],
    trend: rep.sentiment.trend.map((t) => [t.period, t.count, t.score]), themes: rep.sentiment.themes.map((t) => [t.theme, t.count, t.negative, t.requests]),
    team: rep.team, revenue: [rep.revenue.booked, rep.revenue.margin, rep.revenue.margin_pct, rep.revenue.pipeline, rep.revenue.avg_booking, rep.revenue.quote_to_book_pct],
    by_month: rep.revenue.by_month, funnel: rep.revenue.funnel.map((f) => f.count), lost: rep.revenue.lost_reasons,
    filtered: [rep90.requests, rep90.sentiment.total, rep90.revenue.booked, rep90.team.length],
  };
  if (update) cases.owner_golden = got;
  else check(JSON.stringify(got) === JSON.stringify(cases.owner_golden), `owner golden mismatch
 got ${JSON.stringify(got).slice(0, 600)}`);
}
// 2c. Response Clock + customer care (same in Python)
{
  const NOW = "2026-11-27T02:00:00.000Z";
  const A = (id, name, role) => ({ id, name, role });
  const s1 = A("s1", "Demo Salesperson", "SALES"), s2 = A("s2", "Second Salesperson (sample)", "SALES"), a1 = A("a1", "Demo Travel Agent", "AGENT");
  const S = Q.DEFAULT_SETTINGS;
  const hist = Q.generateHistory(NOW, { sales: [s1, s2], agent: a1 }, 1, S);
  const names = [...new Set(hist.map((r) => r.customer.name))];
  const gm = Q.generateMessages(NOW, [s1, s2, a1], names, S, 1);
  const live = Q.sampleLiveCases(NOW, { sales: s1, sales2: s2, agent: a1 }, S, gm.cases.length + 1, gm.messages.length + 1);
  const messages = [...gm.messages, ...live.messages], cases = [...gm.cases, ...live.cases];
  // stage boundaries: exactly 25/50/75/100% of a 24h clock
  const o = "2026-11-26T00:00:00.000Z", d = "2026-11-27T00:00:00.000Z";
  const at = (h) => new Date(Date.parse(o) + h * 3600000).toISOString();
  check(["green", "yellow", "orange", "red", "overdue"].join() === [5.99, 6, 12, 18, 24].map((h) => Q.stageAt(o, d, null, at(h))).join(), "stage boundaries");
  check(live.cases.map((c) => Q.caseView(c, NOW).stage).join() === "green,yellow,orange,red,green,orange,overdue,yellow,overdue", "live sample cases cover every colour: " + live.cases.map((c) => Q.caseView(c, NOW).stage).join());
  const rep = Q.ownerReport(hist, { range: "all", destination: "", salesperson: "" }, NOW, { messages, cases, settings: S });
  const got = {
    messages: messages.length, cases: cases.map((c) => [c.id, c.situation, c.priority, c.opened_at, c.due_at, c.first_reply_at, c.resolved_at, c.steps.filter((x) => x.done).length, c.owner && c.owner.id]),
    message_moods: messages.map((m) => Q.messageView(m, NOW, S).mood[0]).join(""), reply_keys: messages.slice(0, 30).map((m) => Q.replyKey(m.text)),
    stats: Q.clockStats(cases, NOW), stats90: Q.clockStats(cases, NOW, "2026-08-29T02:00:00.000Z"),
    request_clocks: hist.map((r) => Q.requestClock(r, NOW, S)).filter(Boolean),
    watch: Q.keywordWatch(hist, messages, S.watch_words, 30, NOW).counts,
    team: Q.teamReport(hist, messages, cases, 3, NOW).staff, weekly: Q.weeklyReport(hist, messages, cases, S, NOW),
    client: (() => { const c = Q.clientHistory(Q.nameKey(names[0]), hist, messages, cases, NOW); return [c.name, c.verdict, c.requests.length, c.booked, c.spent, c.rating, c.moods, c.cases.length, c.timeline.length]; })(),
    owner: [rep.briefing, rep.sentiment.total, rep.sentiment.negative, rep.team.map((t) => [t.id, t.messages_handled, t.cases_solved, t.cases_on_time_pct])],
  };
  if (update) cases_golden_out = got;
  else check(JSON.stringify(got) === JSON.stringify(cases_json.care_golden), `care golden mismatch
 got ${JSON.stringify(got).slice(0, 800)}`);
  // rules
  const c0 = Q.openCase({ id: "C1", now: NOW, source: "message", text: "Nawala po passport ko dito sa Seoul", client: "X", client_key: "n:x", by: "AI" }, S);
  check(c0.situation === "documents" && c0.priority === "urgent" && c0.due_at === "2026-11-28T02:00:00.000Z" && c0.reply_due_at === "2026-11-27T03:00:00.000Z", "urgent case deadlines");
  const throwsCase = (fn, msg) => { try { fn(); check(false, "expected error: " + msg); } catch (e) { check(e instanceof Q.CaseError, msg + " -> " + e.message); } };
  throwsCase(() => Q.caseAct(c0, "reply", s1, {}, NOW, S), "sales cannot work an unassigned case they don't own");
  let c1 = Q.caseAct(c0, "assign", s1, { assignee: { id: "s1", name: "Demo Salesperson" } }, NOW, S);
  throwsCase(() => Q.caseAct(c1, "assign", s2, { assignee: { id: "s2", name: "x" } }, NOW, S), "sales cannot take someone else's case");
  c1 = Q.caseAct(c1, "solve", s1, {}, "2026-11-27T20:00:00.000Z", S);
  check(Q.caseView(c1, NOW).on_time && c1.first_reply_at, "solved on time sets first reply");
  check(Q.autoCaseFor("customer_feedback", "", 2)?.source === "feedback" && Q.autoCaseFor("customer_feedback", "", 4) === null, "low rating opens a case");
  check(Q.autoCaseFor("customer_question", "Ang tagal po ng reply ninyo, wala pa rin update!", null)?.source === "request", "unhappy question opens a case");
  const rq = hist.find((r) => r.status === "lost");
  check(Q.requestClock({ ...rq, status: "ai_recommended", events: rq.events.slice(0, 2), customer_question: null }, NOW, S)?.stage === "overdue", "old unanswered request is overdue");
}
if (update) cases.care_golden = cases_golden_out;
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
