export type Sentiment = "positive" | "neutral" | "negative";
export type Priority = "critical" | "high" | "medium" | "low";

export interface Me { id: string; email: string; full_name: string; role: string; permissions: string[] }

export interface FeedbackItem {
  id: string; platform: string; platform_name: string; author: string; content: string; rating: number | null; language: string;
  created_at: string; is_sample: boolean; review_status: string; action_status: string; sentiment: Sentiment; ai_sentiment: Sentiment;
  score: number; confidence: number; possible_sarcasm: boolean; emotion: string; intent: string; topics: string[]; topic: string;
  priority: Priority; engine: string;
  client: string; is_imported: boolean; first_reply_at: string | null; handled_by: string | null; watch_hits: string[];
}
export interface ReviewEntry { field: string; original: string; corrected: string; note: string; reviewer: string; at: string }
export interface FeedbackDetail extends FeedbackItem {
  reason: string; recommended_action: string; intent_reason: string; priority_reason: string;
  ai: { sentiment: string; emotion: string; intent: string; priority: string }; emotion_scores: Record<string, number>;
  model_version: string; analyzed_at: string | null; source_url: string | null; external_id: string | null; parent_reference: string | null;
  collected_at: string; reviews: ReviewEntry[]; client_messages: number;
}
export interface Paged<T> { total: number; page: number; page_size: number; items: T[] }

export interface Filters {
  date_from?: string; date_to?: string; platform?: string; sentiment?: string; priority?: string; emotion?: string; intent?: string;
  topic?: string; review?: string; action?: string; search?: string; include_sample?: boolean;
}

export interface Kpis {
  total: number; positive: number; negative: number; neutral: number; pending_review: number; high_priority: number; critical: number;
  unresolved_high_priority: number; average_score: number; positive_pct: number; negative_pct: number; neutral_pct: number;
  overall_sentiment_pct: number; sample_count: number;
}
export interface InsightSummary { overall: string; positives: string; complaints: string; emerging: string; recurring: string; trend: string; actions: string }
export interface Insight {
  id: number; summary: InsightSummary; aggregates: any; engine: string; filters: Record<string, unknown>;
  period: { from: string; to: string }; created_at: string;
}
export interface Dashboard {
  kpis: Kpis; distribution: { name: string; value: number }[];
  trend: { period: string; positive: number; neutral: number; negative: number; avg_score: number }[];
  by_platform: { platform: string; positive: number; neutral: number; negative: number; total: number }[];
  top_topics: { topic: string; count: number }[]; top_complaints: { topic: string; count: number }[];
  most_appreciated: { topic: string; count: number }[]; emotions: { emotion: string; count: number }[];
  priorities: { level: string; count: number }[]; intents: { intent: string; count: number }[];
  granularity: string; period: { from: string; to: string }; latest_insight: Omit<Insight, "aggregates" | "filters"> | null;
}
export interface AnalyzeResult {
  sentiment: Sentiment; score: number; confidence: number; confidence_band: string; emotion: string; intent: string; intent_reason: string;
  topics: string[]; possible_sarcasm: boolean; reason: string; priority: Priority; priority_reason: string; recommended_action: string;
  language: string; engine: string; model_version: string;
}
export interface Integration {
  code: string; name: string; status: string; detail: string; missing: string[]; required_env: string[]; docs_url: string;
  last_sync_at: string | null; feedback_count: number; sample_count: number;
}
export interface Notice { id: number; kind: string; severity: string; title: string; message: string; feedback_id: string | null; read: boolean; created_at: string }
export interface ReportRow { id: number; report_type: string; name: string; file_format: string; period: { from: string; to: string }; created_at: string; sample?: boolean }
export interface UserRow { id: string; email: string; full_name: string; role: string; is_active: boolean; last_login_at: string | null; created_at: string }
export interface AuditRow { id: number; actor: string; action: string; entity: string; entity_id: string; details: any; ip: string; created_at: string }
export interface SettingsData {
  sentiment_thresholds: { negative_max: number; positive_min: number };
  confidence_thresholds: { high: number; moderate: number };
  ai_provider: { provider: string; claude_model: string; api_key_set: boolean };
  alerts: { negative_spike_pct: number; repeated_complaint_count: number; unresolved_days: number; email_enabled: boolean };
  retention: { feedback_days: number; audit_days: number };
  response_clock?: { urgent_hours: number; important_hours: number; urgent_reply_minutes: number; important_reply_minutes: number };
  keyword_watch?: { words: string[] };
  weekly_report?: { enabled: boolean; recipients: string; last_sent_week?: string };
}

// ---------- team tools ----------
export interface ClientHistory {
  ref: string; name: string; total: number; first_seen: string; last_seen: string; moods: { positive: number; neutral: number; negative: number };
  avg_score: number; platforms: Record<string, number>; verdict: string; feelings: { at: string; score: number; sentiment: Sentiment }[];
  open_cases: CaseInfo[]; timeline: FeedbackItem[];
}
export interface ReplyTemplate { id: number; situation: string; situation_label: string; language: "en" | "tl"; title: string; body: string; is_default: boolean; updated_by: string; updated_at: string | null }
export interface ReplyLibrary { situations: Record<string, string>; languages: Record<string, string>; items: ReplyTemplate[] }
export interface Suggestion { situation: string; situation_label: string; templates: ReplyTemplate[] }
export type TemplateInput = Pick<ReplyTemplate, "situation" | "language" | "title" | "body">;
export interface WatchResult { words: string[]; days: number; total: number; counts: { word: string; count: number }[]; items: FeedbackItem[] }
export interface TeamStat { name: string; handled: number; replied: number; solved: number; avg_first_reply_minutes: number | null; avg_resolution_minutes: number | null }
export interface TeamRow {
  id: string; content: string; platform: string; platform_name: string; is_sample: boolean; handler: string; started_at: string; month: string;
  is_case: boolean; priority: Priority; first_reply_minutes: number | null; resolution_minutes: number | null; status: "solved" | "replied" | "waiting";
}
export interface TeamReport { period: { from: string; to: string }; months: string[]; team: string[]; totals: Omit<TeamStat, "name">; staff: TeamStat[]; by_month: (TeamStat & { month: string })[]; items: TeamRow[] }
export interface WeeklyReport {
  subject: string; period: { from: string; to: string }; verdict: string;
  kpis: { total: number; positive_pct: number; negative_pct: number; prev_negative_pct: number; prev_total: number; urgent_open: number; sample_count: number };
  clock: { open: number; overdue: number; solved: number; on_time_pct: number | null };
  top_complaints: { topic: string; count: number }[]; most_appreciated: { topic: string; count: number }[];
  watch: { word: string; count: number }[]; team: { name: string; handled: number; avg_first_reply_minutes: number | null }[]; actions: string[];
  enabled: boolean; recipients: string[]; recipients_setting: string; email_ready: boolean; last_sent_week: string; schedule: string;
}
export interface ImportRow { date: string; client: string; message: string; channel: string }
export interface ImportResult { total: number; imported: number; duplicates: number; skipped: { row: number; reason: string }[]; skipped_count: number; by_channel: Record<string, number> }

export interface CaseUpdate { at: string; by: string; kind: "opened" | "assigned" | "reply" | "step" | "note" | "escalated" | "solved" | "reopened" | "traveling"; text: string }
export interface CaseInfo {
  id: string; content: string; platform: string; platform_name: string; author: string; priority: Priority; topic: string; is_sample: boolean;
  headline: { emotion: string; intent: string; topic: string; sentiment: string };
  situation: string; traveling_now: boolean; opened_at: string; due_at: string; deadline_hours: number;
  reply_due_at: string; first_reply_at: string | null; resolved_at: string | null; last_update_at: string;
  assignee: string | null; escalated: boolean; steps: { text: string; done: boolean }[]; updates: CaseUpdate[];
}
export interface CaseStats {
  open: number; on_track: number; needs_progress: number; at_risk: number; due_soon: number; overdue: number; traveling_now: number; no_reply_yet: number;
  solved_30d: number; solved_on_time_pct: number | null; avg_solve_minutes: number | null; avg_first_reply_minutes: number | null;
}
export type CaseAction =
  | { kind: "assign"; assignee: string } | { kind: "reply"; text?: string } | { kind: "step"; index: number } | { kind: "note"; text: string }
  | { kind: "solve"; text?: string } | { kind: "reopen" } | { kind: "traveling"; value: boolean };
export interface ReviewInput { sentiment?: string; emotion?: string; intent?: string; priority?: string; note?: string; use_for_evaluation?: boolean }

export interface Api {
  mode: "server" | "demo";
  login(email: string, password: string): Promise<Me>;
  logout(): void;
  me(): Promise<Me | null>;
  dashboard(f: Filters, granularity?: string): Promise<Dashboard>;
  feedback(f: Filters, page: number, pageSize: number): Promise<Paged<FeedbackItem>>;
  feedbackDetail(id: string): Promise<FeedbackDetail>;
  addFeedback(content: string, author?: string, rating?: number | null): Promise<FeedbackDetail>;
  review(id: string, body: ReviewInput): Promise<FeedbackDetail>;
  setStatus(id: string, status: string): Promise<FeedbackDetail>;
  reanalyze(id: string): Promise<FeedbackDetail>;
  analyze(text: string, rating?: number | null): Promise<AnalyzeResult>;
  generateInsight(f: Filters): Promise<Insight>;
  insights(): Promise<Insight[]>;
  integrations(): Promise<Integration[]>;
  sync(code: string): Promise<any>;
  loadSample(): Promise<{ added: number }>;
  clearSample(): Promise<{ deleted: number }>;
  notifications(): Promise<{ unread: number; items: Notice[] }>;
  markRead(id: number): Promise<void>;
  markAllRead(): Promise<void>;
  reportTypes(): Promise<{ code: string; name: string }[]>;
  reports(): Promise<ReportRow[]>;
  createReport(type: string, format: string, f: Filters): Promise<ReportRow>;
  downloadReport(r: ReportRow): Promise<void>;
  users(): Promise<UserRow[]>;
  createUser(u: { email: string; full_name: string; role: string; password: string }): Promise<UserRow>;
  updateUser(id: string, patch: Partial<{ full_name: string; role: string; is_active: boolean; password: string }>): Promise<UserRow>;
  settings(): Promise<SettingsData>;
  saveSetting(key: keyof SettingsData, value: Record<string, unknown>): Promise<unknown>;
  audit(action?: string, page?: number): Promise<AuditRow[]>;
  cases(view: "open" | "solved" | "all"): Promise<{ items: CaseInfo[]; stats: CaseStats; team: string[] }>;
  caseAction(id: string, action: CaseAction): Promise<CaseInfo>;
  // team tools
  client(ref: string): Promise<ClientHistory>;
  replyTemplates(): Promise<ReplyLibrary>;
  saveTemplate(t: TemplateInput, id?: number): Promise<ReplyTemplate>;
  deleteTemplate(id: number): Promise<void>;
  suggestions(feedbackId: string): Promise<Suggestion>;
  markReplied(feedbackId: string): Promise<FeedbackDetail>;
  keywordWatch(days: number): Promise<WatchResult>;
  teamReport(months: number): Promise<TeamReport>;
  downloadTeamReport(months: number): Promise<void>;
  weeklyReport(): Promise<WeeklyReport>;
  sendWeeklyReport(): Promise<{ sent: boolean; detail: string }>;
  importRows(fileName: string, rows: ImportRow[]): Promise<ImportResult>;
}
