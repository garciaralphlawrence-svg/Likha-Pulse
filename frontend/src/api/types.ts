// API contract shared by the browser demo (demo/demoApi.ts) and the FastAPI server (api/server.ts -> backend/app/api).
import type { Parsed, Recommendation, TripInput } from "../quote/engine";
import type { OwnerFilters, OwnerReport } from "../quote/owner";
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
}
/** Everything staff need on one request. */
export interface RequestDetail extends TravelRequest { allowed: ActionCode[]; expired: boolean; waiting_hours: number; terms: QuotationTerms | null }

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
  users(): Promise<UserRow[]>;
  createUser(u: { email: string; full_name: string; role: string; password: string }): Promise<UserRow>;
  updateUser(id: string, patch: Partial<{ full_name: string; role: string; is_active: boolean; password: string }>): Promise<UserRow>;
  audit(page?: number): Promise<AuditRow[]>;
}
