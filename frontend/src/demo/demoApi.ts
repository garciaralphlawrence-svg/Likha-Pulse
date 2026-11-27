// In-browser version of the API for the public demo (GitHub Pages). Everything is stored in this browser only.
// Every request seeded here is SAMPLE data, priced from the SAMPLE rate catalog (src/quote/catalog.json).
import type { Api, AuditRow, Me, StaffMember, UserRow } from "../api/types";
import { parseRequest } from "../quote/engine";
import { contactMatches, dashboard, detail, list, publicView } from "../quote/views";
import { generateHistory } from "../quote/history";
import { ownerReport } from "../quote/owner";
import HISTORY from "../quote/sample_history.json";
import { CaseAction, caseAct, caseView, clockStats, openCase, autoCaseFor, sortCases, type Case } from "../quote/clock";
import { DEFAULT_REPLIES, type CustomerMessage, type ReplyTemplate, clientHistory, contactKey, generateMessages, importRows, keywordWatch, markReplied, messageView, sampleLiveCases, teamReport, weeklyReport, cleanWords } from "../quote/care";
import { parseRequest as parseText } from "../quote/engine";
import { ACTIONS, ActionCode, ActionPayload, Actor, DEFAULT_SETTINGS, Role, Settings, TravelRequest, apply, createRequest } from "../quote/workflow";

const KEY = "paph.demo.v3"; // v3: Response Clock, Facebook/Messenger messages, team tools
const SESSION = "paph.demo.session";
const PERMS: Record<string, string[]> = {
  ADMIN: ["owner.view", "replies.manage", "import.manage", "integrations.manage", "dashboard.view", "requests.view", "requests.sell", "requests.approve", "catalog.view", "users.manage", "settings.manage", "audit.view"],
  AGENT: ["dashboard.view", "requests.view", "requests.approve", "catalog.view", "audit.view"],
  SALES: ["requests.view", "requests.sell", "catalog.view"],
};
export const DEMO_ACCOUNTS = [
  { email: "admin@demo.paph", password: "Admin2026!", role: "ADMIN", full_name: "Demo Owner", label: "Owner" },
  { email: "sales@demo.paph", password: "Sales2026!", role: "SALES", full_name: "Demo Salesperson", label: "Salesperson" },
  { email: "agent@demo.paph", password: "Agent2026!", role: "AGENT", full_name: "Demo Travel Agent", label: "Travel agent" },
];

interface DemoUser extends UserRow { pw: string }
interface Store {
  requests: TravelRequest[]; users: DemoUser[]; audit: AuditRow[]; settings: Settings; seq: number; auditSeq: number; seeded_at: string;
  messages: CustomerMessage[]; cases: Case[]; templates: ReplyTemplate[]; caseSeq: number; msgSeq: number; tplSeq: number;
}
let store: Store | null = null;
let me: Me | null = null;

async function sha(s: string) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join(""); }
const uid = () => Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-6);
const now = () => new Date().toISOString();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage blocked: keep in memory */ } };
const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));

async function db(): Promise<Store> {
  if (store) return store;
  try { const raw = localStorage.getItem(KEY); if (raw) store = JSON.parse(raw); } catch { store = null; }
  // rebuilt once a day so "waiting since" times and validity dates stay realistic
  if (store && Date.now() - +new Date(store.seeded_at) > 20 * 3600000) store = null;
  if (!store) {
    const users: DemoUser[] = [];
    for (const a of DEMO_ACCOUNTS) users.push({ id: uid(), email: a.email, full_name: a.full_name, role: a.role, is_active: true, last_login_at: null, created_at: now(), pw: await sha(a.password) });
    users.push({ id: uid(), email: "sales2@demo.paph", full_name: "Second Salesperson (sample)", role: "SALES", is_active: true, last_login_at: null, created_at: now(), pw: "" });
    store = { requests: [], users, audit: [], settings: { ...DEFAULT_SETTINGS }, seq: 1, auditSeq: 1, seeded_at: now(), messages: [], cases: [], templates: [], caseSeq: 1, msgSeq: 1, tplSeq: 1 };
    store.templates = DEFAULT_REPLIES.map((t) => ({ ...t, id: store!.tplSeq++, is_default: true, updated_by: "PAPH", updated_at: store!.seeded_at }));
    seed(store);
    save();
  }
  return store;
}

const actorOf = (u: { id: string; full_name: string; role: string }): Actor => ({ id: u.id, name: u.full_name, role: u.role as Role });
function log(s: Store, actor: string, action: string, entity: string, entity_id: string, details: Record<string, unknown> = {}, at = now()) {
  s.audit.unshift({ id: s.auditSeq++, actor, action, entity, entity_id, details, created_at: at });
}

// ---------- sample requests, walked through the real workflow ----------
function seed(s: Store) {
  const [owner, sales, agent, sales2] = s.users.map(actorOf);
  // ~6 months of closed sample requests first (oldest reference numbers), then the live sample queue
  for (const r of generateHistory(now(), { sales: [sales, sales2], agent }, s.seq, s.settings)) {
    s.requests.push(r);
    for (const e of r.events) { const u = s.users.find((x) => x.full_name === e.by); if (u) log(s, u.email, `request_${e.action}`, "request", r.ref, {}, e.at); }
  }
  s.seq += HISTORY.count;
  // Facebook comments and Messenger chats (6 months, handled), then the live sample cases (one at every colour)
  const names = [...new Set(s.requests.map((r) => r.customer.name))];
  const gm = generateMessages(now(), [sales, sales2, agent], names, s.settings, 1);
  const live = sampleLiveCases(now(), { sales, sales2, agent }, s.settings, gm.cases.length + 1, gm.messages.length + 1);
  s.messages.push(...gm.messages, ...live.messages); s.cases.push(...gm.cases, ...live.cases);
  s.caseSeq = s.cases.length + 1; s.msgSeq = s.messages.length + 1;
  const H = 3600000, t = (hoursAgo: number) => new Date(Date.now() - hoursAgo * H).toISOString();
  const make = (hoursAgo: number, name: string, contact: string, text: string, extra: Record<string, unknown> = {}, addons: string[] = []) => {
    const parsed = { ...parseRequest(text, t(hoursAgo)), ...extra };
    const r = createRequest({ id: uid(), seq: s.seq++, now: t(hoursAgo), customer: { name, contact }, raw_text: text, input: parsed, addons, is_sample: true }, s.settings);
    s.requests.push(r);
    return r;
  };
  const step = (r: TravelRequest, action: ActionCode, who: Actor, hoursAgo: number, payload: ActionPayload = {}) => {
    const next = apply(r, action, who, payload, t(hoursAgo), s.settings);
    s.requests[s.requests.findIndex((x) => x.id === r.id)] = next;
    if (who.role !== "CUSTOMER") log(s, s.users.find((u) => u.id === who.id)!.email, `request_${action}`, "request", r.ref, {}, t(hoursAgo));
    return next;
  };
  const cust = (r: TravelRequest): Actor => ({ id: "customer", name: r.customer.name, role: "CUSTOMER" });

  make(30, "Sample: Paolo R.", "0917 555 0101", "gusto ko pumunta London 10 days, 5 star hotel");
  make(3, "Sample: Jessa M.", "jessa.sample@example.com", "budget friendly London 10 days ₱80,000");
  make(52, "Sample: Iris T.", "0917 555 0113", "We want to go to Iceland for 8 days in March, 2 adults");

  let r = make(20, "Sample: Dela Cruz family", "0918 555 0103", "budget friendly lang, Japan 5 days, 2 adults 1 kid, December, Disneyland", {}, ["insurance"]);
  r = step(r, "start_offer", sales, 18);

  r = make(9, "Sample: Carlo and Bianca", "0919 555 0104", "Seoul 4 nights kami ng asawa ko, 60k each, April");
  r = step(r, "start_offer", sales, 8);
  r = step(r, "save_offer", sales, 7, { discount: Math.round(r.offer!.totals.margin * 0.4), notes: "Repeat customers. Small discount to close." });
  r = step(r, "submit", sales, 6);

  r = make(4, "Sample: Mika and Joel", "mika.sample@example.com", "Honeymoon in Bali, Dec 20-26, luxury villa please, budget PHP 250,000", {}, ["wifi"]);
  r = step(r, "start_offer", sales2, 3);
  r = step(r, "submit", sales2, 2);

  r = make(40, "Sample: Barkada ni Ken", "0920 555 0106", "Boracay isang linggo, barkada kami 6 tao, mura lang, August");
  r = step(r, "start_offer", sales, 38);
  r = step(r, "submit", sales, 37);
  r = step(r, "approve", agent, 30);
  r = step(r, "send", sales, 29);
  r = step(r, "customer_question", cust(r), 5, { note: "Kasama na po ba ang breakfast sa hotel?" });

  r = make(26, "Sample: Ramos family", "0921 555 0107", "family of 4 Hong Kong Disneyland 3 days, mga 100k budget");
  r = step(r, "start_offer", sales, 24);
  r = step(r, "submit", sales, 23);
  r = step(r, "request_changes", agent, 5, { note: "Over their ₱100k budget. Use the budget hotel option and drop one tour." });

  r = make(72, "Sample: Lea S.", "0922 555 0108", "Singapore 4 days, 2 adults, Universal Studios, 4 star");
  r = step(r, "start_offer", sales, 70);
  r = step(r, "submit", sales, 69);
  r = step(r, "approve", agent, 60);
  r = step(r, "send", sales, 59);
  r = step(r, "customer_accept", cust(r), 30);

  r = make(24 * 12, "Sample: Villanueva group", "0923 555 0109", "Dubai 6 days 3 pax 4 star, desert safari");
  r = step(r, "start_offer", sales2, 24 * 12 - 2);
  r = step(r, "submit", sales2, 24 * 12 - 3);
  r = step(r, "approve", agent, 24 * 11);
  r = step(r, "send", sales2, 24 * 11 - 1);
  r = step(r, "customer_accept", cust(r), 24 * 10);
  r = step(r, "mark_booked", sales2, 24 * 9);

  r = make(24 * 8, "Sample: Tan family", "0924 555 0110", "Paris and Disneyland trip for 2 adults and 2 kids, 7 days, P1.2M");
  r = step(r, "start_offer", sales, 24 * 8 - 2);
  r = step(r, "submit", sales, 24 * 8 - 3);
  r = step(r, "approve", owner, 24 * 7);
  r = step(r, "send", sales, 24 * 7 - 1);
  r = step(r, "mark_lost", sales, 24 * 3, { reason: "price", note: "Found a cheaper package online." });

  r = make(24 * 15, "Sample: Grace L.", "0925 555 0111", "Taipei 4D3N 3 pax 4 star");
  r = step(r, "start_offer", sales, 24 * 15 - 1);
  r = step(r, "submit", sales, 24 * 15 - 2);
  r = step(r, "approve", agent, 24 * 14);
  r = step(r, "send", sales, 24 * 14 - 1);
  r = step(r, "customer_accept", cust(r), 24 * 13);
  r = step(r, "mark_booked", sales, 24 * 12);

  r = make(24 * 10, "Sample: Nico P.", "0926 555 0112", "may kasama akong 2 bata, El Nido 5 days, 2 adults");
  r = step(r, "start_offer", sales, 24 * 10 - 1);
  r = step(r, "submit", sales, 24 * 10 - 2);
  r = step(r, "approve", agent, 24 * 9);
  r = step(r, "send", sales, 24 * 9 - 1);

  r = make(24 * 5, "Sample: Ortega couple", "0927 555 0114", "Bangkok 5 days couple, food trip, December 26-30");
  r = step(r, "start_offer", sales2, 24 * 5 - 2);
  r = step(r, "submit", sales2, 24 * 5 - 3);
  r = step(r, "decline", agent, 24 * 4, { note: "All partner hotels are full for those dates. Sales to call and offer January instead." });
  void r;

  for (const u of s.users.slice(0, 3)) log(s, u.email, "login", "user", u.id, {}, t(1 + Math.random() * 20));
  s.audit.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ---------- customer care helpers ----------
const nextCase = (s: Store) => `CASE-${String(s.caseSeq++).padStart(4, "0")}`;
function autoCase(s: Store, r: TravelRequest, action: ActionCode, note: string, rating: number | null) {
  const a = autoCaseFor(action, note, rating);
  if (!a) return;
  s.cases.push(openCase({ id: nextCase(s), now: now(), source: a.source, situation: a.situation, text: note || `${rating} of 5 stars`, client: r.customer.name, client_key: contactKey(r.customer.contact), by: "PAPH AI",
    request: { id: r.id, ref: r.ref }, owner: r.assignee, is_sample: r.is_sample, rating }, s.settings));
}
/** Owner sees every case; others see cases they own, cases on requests assigned to them, and unassigned open ones. */
function canSee(s: Store, c: Case) {
  if (me!.role === "ADMIN") return true;
  if (c.owner?.id === me!.id) return true;
  if (c.request_id && s.requests.find((r) => r.id === c.request_id)?.assignee?.id === me!.id) return true;
  return !c.owner && !c.resolved_at;
}
const RANK: Record<string, number> = { overdue: 0, red: 1, orange: 2, yellow: 3, green: 4 };
const sortByClock = <T extends { clock: { stage: string; opened_at: string } | null }>(xs: T[]) => [...xs].sort((a, b) => RANK[a.clock!.stage] - RANK[b.clock!.stage] || a.clock!.opened_at.localeCompare(b.clock!.opened_at));

// ---------- API ----------
function need(perm: string) { if (!me?.permissions.includes(perm)) throw new Error("Your role can't open this page."); }
const toMe = (u: DemoUser): Me => ({ id: u.id, email: u.email, full_name: u.full_name, role: u.role as Me["role"], permissions: PERMS[u.role] ?? [] });
function find(s: Store, ref: string, contact: string) {
  const r = s.requests.find((x) => x.ref.toUpperCase() === ref.trim().toUpperCase());
  if (!r || !contactMatches(r.customer.contact, contact)) throw new Error("We couldn't find a request with that reference number and contact.");
  return r;
}

export const demoApi: Api = {
  mode: "demo",
  async login(email, password) {
    const s = await db(); const u = s.users.find((x) => x.email === email.toLowerCase().trim());
    if (!u || !u.is_active || !u.pw || u.pw !== (await sha(password))) { log(s, email, "login_failed", "user", ""); save(); throw new Error("Incorrect email or password"); }
    u.last_login_at = now(); me = toMe(u); log(s, u.email, "login", "user", u.id); save();
    try { sessionStorage.setItem(SESSION, u.id); } catch { /* ignore */ }
    return me;
  },
  logout() { me = null; try { sessionStorage.removeItem(SESSION); } catch { /* ignore */ } },
  async me() { const s = await db(); let id: string | null = null; try { id = sessionStorage.getItem(SESSION); } catch { /* ignore */ } const u = s.users.find((x) => x.id === id && x.is_active); me = u ? toMe(u) : null; return me; },

  async submitRequest(n) {
    const s = await db();
    const r = createRequest({ id: uid(), seq: s.seq++, now: now(), customer: n.customer, raw_text: n.raw_text, input: n.input, addons: n.addons }, s.settings);
    s.requests.push(r); log(s, "customer", "request_submitted", "request", r.ref); save();
    return wait({ ref: r.ref, contact: r.customer.contact });
  },
  async track(ref, contact) { const s = await db(); return wait(publicView(find(s, ref, contact), s.settings, now())); },
  async customerAction(ref, contact, action, note, rating) {
    const s = await db(); const r = find(s, ref, contact);
    if (!ACTIONS[action]?.roles.includes("CUSTOMER")) throw new Error("Not allowed.");
    const next = apply(r, action, { id: "customer", name: r.customer.name, role: "CUSTOMER" }, { note, rating }, now(), s.settings);
    s.requests[s.requests.indexOf(r)] = next; log(s, "customer", `request_${action}`, "request", r.ref);
    autoCase(s, next, action, note ?? "", rating ?? null); save();
    return publicView(next, s.settings, now());
  },

  async owner(f) { need("owner.view"); const s = await db(); return wait(ownerReport(s.requests, f, now(), { messages: s.messages, cases: s.cases, settings: s.settings })); },
  async dashboard() { need("dashboard.view"); const s = await db(); return wait(dashboard(s.requests, now(), s.settings)); },
  async requests(view) { need("requests.view"); const s = await db(); return wait(list(s.requests, view, now(), s.settings)); },
  async request(id) {
    need("requests.view"); const s = await db(); const r = s.requests.find((x) => x.id === id);
    if (!r) throw new Error("Request not found.");
    return wait(detail(r, me!.role, s.settings, now()));
  },
  async act(id, action, payload) {
    need("requests.view"); const s = await db(); const i = s.requests.findIndex((x) => x.id === id);
    if (i < 0) throw new Error("Request not found.");
    const next = apply(s.requests[i], action, { id: me!.id, name: me!.full_name, role: me!.role }, payload, now(), s.settings);
    s.requests[i] = next; log(s, me!.email, `request_${action}`, "request", next.ref); save();
    return detail(next, me!.role, s.settings, now());
  },
  async staff() { need("requests.view"); return (await db()).users.filter((u) => u.is_active).map((u): StaffMember => ({ id: u.id, name: u.full_name, role: u.role })); },
  async settings() { need("requests.view"); return { ...(await db()).settings }; },
  async saveSettings(v) {
    need("settings.manage"); const s = await db();
    const ok = (x: number, lo: number, hi: number) => Number.isFinite(x) && x >= lo && x <= hi;
    if (!ok(v.urgent_hours, 1, 168) || !ok(v.important_hours, 1, 168) || !ok(v.urgent_reply_minutes, 5, 1440) || !ok(v.important_reply_minutes, 5, 1440) || !ok(v.request_reply_hours, 1, 168)) throw new Error("Response Clock targets: hours 1–168, first-reply minutes 5–1440.");
    v = { ...v, watch_words: cleanWords(v.watch_words ?? []), weekly_recipients: String(v.weekly_recipients ?? "").slice(0, 500) };
    if (!ok(v.service_fee_pct, 0, 40) || !ok(v.min_margin_pct, 0, 40) || !ok(v.validity_days, 1, 60) || !ok(v.deposit_pct, 0, 100) || !ok(v.balance_days_before, 0, 120)) throw new Error("Please check the numbers: fee and margin 0–40%, validity 1–60 days, deposit 0–100%, balance 0–120 days.");
    s.settings = { ...v }; log(s, me!.email, "setting_changed", "setting", "quotes", { ...v }); save(); return s.settings;
  },
  async messages(view) {
    need("requests.view"); const s = await db(); const t = now();
    const refOf = (id: string) => s.requests.find((r) => r.id === id)?.ref ?? null;
    const vs = s.messages.map((m) => messageView(m, t, s.settings, refOf));
    if (view === "waiting") return wait(sortByClock(vs.filter((m) => m.clock)));
    return wait(vs.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 300));
  },
  async messageAction(id, action) {
    need("requests.view"); const s = await db(); const i = s.messages.findIndex((m) => m.id === id); if (i < 0) throw new Error("Message not found.");
    let m = s.messages[i]; const actor = { id: me!.id, name: me!.full_name, role: me!.role };
    if (action === "reply") m = markReplied(m, actor, now());
    if (action === "open_case") {
      if (m.case_id && s.cases.some((c) => c.id === m.case_id && !c.resolved_at)) throw new Error("A case is already open for this message.");
      const c = openCase({ id: nextCase(s), now: now(), source: "message", text: m.text, client: m.client, client_key: m.client_key, by: me!.full_name, message_id: m.id, owner: me!.role === "ADMIN" ? null : { id: me!.id, name: me!.full_name }, is_sample: m.is_sample }, s.settings);
      s.cases.push(c); m = { ...m, case_id: c.id };
    }
    if (action === "make_request") {
      if (m.request_id) throw new Error("This message already has a quotation request.");
      const r = createRequest({ id: uid(), seq: s.seq++, now: now(), customer: { name: m.client, contact: `${m.channel === "messenger" ? "Messenger" : "Facebook"}: ${m.client}` }, raw_text: m.text, input: parseText(m.text, now()), addons: [], is_sample: m.is_sample }, s.settings);
      s.requests.push(r); m = { ...markReplied(m, actor, now()), request_id: r.id };
    }
    s.messages[i] = m; log(s, me!.email, `message_${action}`, "message", m.id); save();
    return messageView(m, now(), s.settings, (rid) => s.requests.find((r) => r.id === rid)?.ref ?? null);
  },
  async cases(view) {
    need("requests.view"); const s = await db(); const t = now();
    const visible = s.cases.filter((c) => canSee(s, c));
    const items = view === "open" ? sortCases(visible.filter((c) => !c.resolved_at).map((c) => caseView(c, t))) : visible.filter((c) => c.resolved_at).map((c) => caseView(c, t)).sort((a, b) => b.resolved_at!.localeCompare(a.resolved_at!)).slice(0, 100);
    return wait({ items, stats: clockStats(visible, t, new Date(Date.now() - 90 * 86400000).toISOString()), team: s.users.filter((u) => u.is_active && u.pw).map((u) => ({ id: u.id, name: u.full_name, role: u.role })).concat(s.users.filter((u) => u.is_active && !u.pw).map((u) => ({ id: u.id, name: u.full_name, role: u.role }))) });
  },
  async openCase(p) {
    need("requests.view"); const s = await db();
    const r = p.request_id ? s.requests.find((x) => x.id === p.request_id) ?? null : null;
    const m = p.message_id ? s.messages.find((x) => x.id === p.message_id) ?? null : null;
    if (s.cases.some((c) => !c.resolved_at && c.text === p.text && c.request_id === (r?.id ?? null) && c.message_id === (m?.id ?? null))) throw new Error("A case is already open for this message.");
    const c = openCase({ id: nextCase(s), now: now(), source: p.source, text: p.text, client: r?.customer.name ?? m?.client ?? "Customer", client_key: r ? contactKey(r.customer.contact) : m?.client_key ?? "n:customer", by: me!.full_name,
      request: r ? { id: r.id, ref: r.ref } : null, message_id: m?.id ?? null, owner: r?.assignee ?? (me!.role === "ADMIN" ? null : { id: me!.id, name: me!.full_name }), is_sample: r?.is_sample ?? m?.is_sample ?? false }, s.settings);
    s.cases.push(c); if (m) s.messages[s.messages.indexOf(m)] = { ...m, case_id: c.id };
    log(s, me!.email, "case_opened", "case", c.id); save(); return caseView(c, now());
  },
  async caseAction(id, action, payload) {
    need("requests.view"); const s = await db(); const i = s.cases.findIndex((c) => c.id === id); if (i < 0) throw new Error("Case not found.");
    const c = s.cases[i]; const assignee = c.request_id ? s.requests.find((r) => r.id === c.request_id)?.assignee?.id ?? null : null;
    const next = caseAct(c, action as CaseAction, { id: me!.id, name: me!.full_name, role: me!.role }, payload, now(), s.settings, assignee);
    s.cases[i] = next; log(s, me!.email, `case_${action}`, "case", c.id); save(); return caseView(next, now());
  },
  async client(key) { need("requests.view"); const s = await db(); return wait(clientHistory(key, s.requests, s.messages, s.cases, now())); },
  async replyTemplates() { need("requests.view"); return [...(await db()).templates]; },
  async saveTemplate(t, id) {
    need("replies.manage"); const s = await db();
    if (!t.title.trim() || !t.body.trim()) throw new Error("Give the reply a title and a message.");
    const row = { ...t, title: t.title.slice(0, 120), body: t.body.slice(0, 2000), is_default: false, updated_by: me!.full_name, updated_at: now() };
    let out: ReplyTemplate;
    if (id) { const i = s.templates.findIndex((x) => x.id === id); out = { ...s.templates[i], ...row }; s.templates[i] = out; }
    else { out = { ...row, id: s.tplSeq++ }; s.templates.push(out); }
    log(s, me!.email, "template_saved", "template", String(out.id)); save(); return out;
  },
  async deleteTemplate(id) { need("replies.manage"); const s = await db(); s.templates = s.templates.filter((x) => x.id !== id); log(s, me!.email, "template_deleted", "template", String(id)); save(); },
  async keywordWatch(days) { need("owner.view"); const s = await db(); return wait(keywordWatch(s.requests, s.messages, s.settings.watch_words, days, now())); },
  async teamReport(months) { need("owner.view"); const s = await db(); return wait(teamReport(s.requests, s.messages, s.cases, months, now())); },
  async weeklyReport() { need("owner.view"); const s = await db(); return wait(weeklyReport(s.requests, s.messages, s.cases, s.settings, now())); },
  async sendWeeklyReport() { need("owner.view"); const s = await db(); log(s, me!.email, "weekly_report_preview", "report", ""); save(); return { sent: false, detail: "This preview cannot send email. On the real server it is emailed every Monday at 8:00 AM (Philippine time) once SMTP is set up." }; },
  async importRows(fileName, rows) {
    need("import.manage"); const s = await db();
    const { added, result } = importRows(s.messages, rows, now(), () => `msg-${s.msgSeq++}`);
    s.messages.push(...added); log(s, me!.email, "import", "file", fileName, { imported: result.imported }); save(); return result;
  },
  async integrations() {
    need("requests.view"); const s = await db();
    const count = (c: string) => s.messages.filter((m) => m.channel === c).length;
    return [
      { code: "facebook_page", name: "Facebook Page comments", status: "not_connected", detail: "Not connected yet. Needs PAPH's Facebook Page ID and an approved Page access token.", missing: ["META_PAGE_ID", "META_PAGE_ACCESS_TOKEN"], required_env: ["META_PAGE_ID", "META_PAGE_ACCESS_TOKEN"], docs_url: "https://developers.facebook.com/docs/graph-api/reference/page/feed", last_sync_at: null, message_count: count("facebook_page"), sample_count: count("facebook_page") },
      { code: "messenger", name: "Facebook Messenger", status: "not_connected", detail: "Not connected yet. Needs the same Page token with Messenger permission (Meta app review).", missing: ["META_PAGE_ID", "META_PAGE_ACCESS_TOKEN"], required_env: ["META_PAGE_ID", "META_PAGE_ACCESS_TOKEN"], docs_url: "https://developers.facebook.com/docs/messenger-platform", last_sync_at: null, message_count: count("messenger"), sample_count: count("messenger") },
      { code: "import", name: "Imported files (Excel or CSV)", status: "connected", detail: "Always available. Past messages you import count in sentiment and reports.", missing: [], required_env: [], docs_url: "", last_sync_at: null, message_count: count("import"), sample_count: 0 },
    ];
  },
  async syncIntegration(code) { need("integrations.manage"); return { status: "not_connected", added: 0, detail: `${code === "messenger" ? "Messenger" : "Facebook"} is not connected yet, so nothing was synced. This preview uses sample messages.` }; },
  async users() { need("users.manage"); return (await db()).users.map(({ pw, ...u }) => { void pw; return u; }); },
  async createUser(u) {
    need("users.manage"); const s = await db();
    if (s.users.some((x) => x.email === u.email.toLowerCase())) throw new Error("A user with this email already exists");
    if (u.password.length < 10 || !/\d/.test(u.password) || !/[a-z]/i.test(u.password)) throw new Error("Password must be at least 10 characters with letters and numbers.");
    if (!PERMS[u.role]) throw new Error("Choose Owner, Travel agent or Salesperson.");
    const nu: DemoUser = { id: uid(), email: u.email.toLowerCase(), full_name: u.full_name, role: u.role, is_active: true, last_login_at: null, created_at: now(), pw: await sha(u.password) };
    s.users.push(nu); log(s, me!.email, "user_created", "user", nu.id, { email: nu.email, role: nu.role }); save(); const { pw, ...out } = nu; void pw; return out;
  },
  async updateUser(id, patch) {
    need("users.manage"); const s = await db(); const u = s.users.find((x) => x.id === id)!;
    if (u.id === me!.id && (patch.is_active === false || (patch.role && patch.role !== "ADMIN"))) throw new Error("You cannot turn off or change your own owner account");
    if (patch.password) { if (patch.password.length < 10) throw new Error("Password must be at least 10 characters with letters and numbers."); u.pw = await sha(patch.password); }
    if (patch.full_name) u.full_name = patch.full_name;
    if (patch.role) u.role = patch.role;
    if (patch.is_active !== undefined) u.is_active = patch.is_active;
    log(s, me!.email, "user_updated", "user", u.id, { ...patch, password: patch.password ? "reset" : undefined }); save();
    const { pw, ...out } = u; void pw; return out;
  },
  async audit(page = 1) { need("audit.view"); return (await db()).audit.slice((page - 1) * 50, page * 50); },
};

export function resetDemo() { try { localStorage.removeItem(KEY); sessionStorage.removeItem(SESSION); } catch { /* ignore */ } store = null; me = null; }
/** Sample references a visitor can try on the tracking page. */
export const DEMO_TRACK_HINTS = { ready: { seq: HISTORY.count + 7, contact: "0920 555 0106" }, expired: { seq: HISTORY.count + 13, contact: "0926 555 0112" } };
