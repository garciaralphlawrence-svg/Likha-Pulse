// In-browser version of the API for the public demo (GitHub Pages). Everything is stored in this browser only.
// Every request seeded here is SAMPLE data, priced from the SAMPLE rate catalog (src/quote/catalog.json).
import type { Api, AuditRow, Me, StaffMember, UserRow } from "../api/types";
import { parseRequest } from "../quote/engine";
import { contactMatches, dashboard, detail, list, publicView } from "../quote/views";
import { generateHistory } from "../quote/history";
import { ownerReport } from "../quote/owner";
import HISTORY from "../quote/sample_history.json";
import { ACTIONS, ActionCode, ActionPayload, Actor, DEFAULT_SETTINGS, Role, Settings, TravelRequest, apply, createRequest } from "../quote/workflow";

const KEY = "paph.demo.v2"; // v2: 6 months of sample history + owner dashboards
const SESSION = "paph.demo.session";
const PERMS: Record<string, string[]> = {
  ADMIN: ["owner.view", "dashboard.view", "requests.view", "requests.sell", "requests.approve", "catalog.view", "users.manage", "settings.manage", "audit.view"],
  AGENT: ["dashboard.view", "requests.view", "requests.approve", "catalog.view", "audit.view"],
  SALES: ["requests.view", "requests.sell", "catalog.view"],
};
export const DEMO_ACCOUNTS = [
  { email: "admin@demo.paph", password: "Admin2026!", role: "ADMIN", full_name: "Demo Owner", label: "Owner" },
  { email: "sales@demo.paph", password: "Sales2026!", role: "SALES", full_name: "Demo Salesperson", label: "Salesperson" },
  { email: "agent@demo.paph", password: "Agent2026!", role: "AGENT", full_name: "Demo Travel Agent", label: "Travel agent" },
];

interface DemoUser extends UserRow { pw: string }
interface Store { requests: TravelRequest[]; users: DemoUser[]; audit: AuditRow[]; settings: Settings; seq: number; auditSeq: number; seeded_at: string }
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
    store = { requests: [], users, audit: [], settings: { ...DEFAULT_SETTINGS }, seq: 1, auditSeq: 1, seeded_at: now() };
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
    s.requests[s.requests.indexOf(r)] = next; log(s, "customer", `request_${action}`, "request", r.ref); save();
    return publicView(next, s.settings, now());
  },

  async owner(f) { need("owner.view"); return wait(ownerReport((await db()).requests, f, now())); },
  async dashboard() { need("dashboard.view"); return wait(dashboard((await db()).requests, now())); },
  async requests(view) { need("requests.view"); return wait(list((await db()).requests, view, now())); },
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
    if (!ok(v.service_fee_pct, 0, 40) || !ok(v.min_margin_pct, 0, 40) || !ok(v.validity_days, 1, 60) || !ok(v.deposit_pct, 0, 100) || !ok(v.balance_days_before, 0, 120)) throw new Error("Please check the numbers: fee and margin 0–40%, validity 1–60 days, deposit 0–100%, balance 0–120 days.");
    s.settings = { ...v }; log(s, me!.email, "setting_changed", "setting", "quotes", { ...v }); save(); return s.settings;
  },
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
