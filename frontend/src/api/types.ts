// API contract shared by the browser demo (demo/demoApi.ts) and the FastAPI server (api/server.ts -> backend/app/api).
import type { Parsed, Recommendation, TripInput } from "../quote/engine";
import type { OwnerFilters, OwnerReport } from "../quote/owner";
import type { CaseAction, CaseView, ClockInfo, ClockStats } from "../quote/clock";
import type { ImportRow, MessageView, ReplyTemplate, clientHistory, keywordWatch, teamReport, weeklyReport } from "../quote/care";
export type { CaseView, ClockStats, MessageView, ReplyTemplate, ImportRow };
export type ClientHistory = ReturnType<typeof clientHistory>;
export type WatchResult = ReturnType<typeof keywordWatch>;
export type TeamReport = ReturnType<typeof teamReport>;
export type WeeklyReport = ReturnType<typeof weeklyReport>;
export interface ImportResult { total: number; imported: number; duplicates: number; skipped: { row: number; reason: string }[]; skipped_count: number; by_channel: Record<string, number> }
export interface Integration { code: string; name: string; status: "connected" | "not_connected" | "error"; detail: string; missing: string[]; required_env: string[]; docs_url: string; last_sync_at: string | null; message_count: number; sample_count: number }
export type MessageAction = "reply" | "open_case" | "make_request";
export type { OwnerFilters, OwnerReport };
import type { ActionCode, ActionPayload, OfferLine, QuotationTerms, Settings, Status, TravelRequest } from "../quote/workflow";

export type { Settings, TravelRequest };
export interface Me { id: string; email: string; full_name: string; role: "ADMIN" | "AGENT" | "SALES"; permissions: string[] }
export interface UserRow { id: string; email: string; full_name: string; role: string; is_active: boolean; last_login_at: string | null; created_at: string }
export interface AuditRow { id: number; actor: string; action: string; entity: string; entity_id: string; details: Record<string, unknown>; created_at: string }
export interface StaffMember { id: string; name: string; role: string }

/** One row in the sales queue / approvals list. */
export interface RequestSummary {
  id: string; ref: string; created_at: string; updated_at: string; status: Status; is_sample: boolean; customer_name: string;
  destination_name: string; days: number; pax: number; tier_label: string; verdict: string; assignee: string | null;
  ai_low: number | null; ai_high: number | null; offer_price: number | null; margin_pct: number | null;
  flags: { waiting_hours: number; expired: boolean; question: boolean; below_cost: boolean; low_margin: boolean; budget_too_low: boolean };
  /** Response Clock for the reply we owe the customer (null when nobody is waiting on us). */
  clock: ClockInfo | null;
}
/** Everything staff need on one request. */
export interface RequestDetail extends TravelRequest { allowed: ActionCode[]; expired: boolean; waiting_hours: number; clock: ClockInfo | null; terms: QuotationTerms | null }

/** What the customer can see when tracking (never shows PAPH's costs or margin). */
export interface PublicView {
  ref: string; created_at: string; status: Status; customer_status: string; step: number; customer_name: string; input: TripInput;
  recommendation: Recommendation; addons: string[]; expired: boolean; question: { text: string; at: string } | null; feedback: { rating: number; text: string; at: string } | null;
  offer: { option: string | null; lines: Pick<OfferLine, "label" | "detail" | "price">[]; discount: number; total: number; per_person: number; notes: string } | null;
  terms: QuotationTerms | null; timeline: { at: string; label: string }[]; can: ActionCode[];
}
export interface NewRequest { customer: { name: string; contact: string }; raw_text: string; input: Partial<Parsed>; addons: string[] }

export interface Dashboard {
  total: number; open: number; booked: number; lost: number; declined: number; conversion_pct: number | null; avg_quote: number | null; pipeline_value: number;
  by_status: { status: Status; label: string; count: number }[]; top_destinations: { code: string; name: string; count: number }[];
  lost_reasons: { reason: string; label: string; count: number }[]; awaiting_decision: RequestSummary[]; waiting_long: number; sample_count: number;
  /** quotation requests still waiting for our reply, by clock colour */
  request_clock: Record<string, number>;
}

export interface Api {
  mode: "server" | "demo";
  login(email: string, password: string): Promise<Me>;
  logout(): void;
  me(): Promise<Me | null>;
  // customer (public, no login)
  submitRequest(r: NewRequest): Promise<{ ref: string; contact: string }>;
  track(ref: string, contact: string): Promise<PublicView>;
  customerAction(ref: string, contact: string, action: ActionCode, note?: string, rating?: number): Promise<PublicView>;
  // staff
  dashboard(): Promise<Dashboard>;
  /** Owner only: briefing, customer sentiment, team performance, revenue. */
  owner(f: OwnerFilters): Promise<OwnerReport>;
  requests(view: "queue" | "approval" | "open" | "closed" | "all"): Promise<RequestSummary[]>;
  request(id: string): Promise<RequestDetail>;
  act(id: string, action: ActionCode, payload: ActionPayload): Promise<RequestDetail>;
  staff(): Promise<StaffMember[]>;
  settings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<Settings>;
  // customer care
  messages(view: "waiting" | "all"): Promise<MessageView[]>;
  messageAction(id: string, action: MessageAction): Promise<MessageView & { request_id: string | null; case_id: string | null }>;
  cases(view: "open" | "solved"): Promise<{ items: CaseView[]; stats: ClockStats; team: StaffMember[] }>;
  openCase(p: { request_id?: string | null; message_id?: string | null; text: string; source: "request" | "message" | "feedback" | "manual" }): Promise<CaseView>;
  caseAction(id: string, action: CaseAction, payload: { note?: string; index?: number; value?: boolean; assignee?: { id: string; name: string } }): Promise<CaseView>;
  client(key: string): Promise<ClientHistory>;
  replyTemplates(): Promise<ReplyTemplate[]>;
  saveTemplate(t: Pick<ReplyTemplate, "situation" | "language" | "title" | "body">, id?: number): Promise<ReplyTemplate>;
  deleteTemplate(id: number): Promise<void>;
  keywordWatch(days: number): Promise<WatchResult>;
  teamReport(months: number): Promise<TeamReport>;
  weeklyReport(): Promise<WeeklyReport>;
  sendWeeklyReport(): Promise<{ sent: boolean; detail: string }>;
  importRows(fileName: string, rows: ImportRow[]): Promise<ImportResult>;
  integrations(): Promise<Integration[]>;
  syncIntegration(code: string): Promise<{ status: string; added: number; detail: string }>;
  users(): Promise<UserRow[]>;
  createUser(u: { email: string; full_name: string; role: string; password: string }): Promise<UserRow>;
  updateUser(id: string, patch: Partial<{ full_name: string; role: string; is_active: boolean; password: string }>): Promise<UserRow>;
  audit(page?: number): Promise<AuditRow[]>;
}
