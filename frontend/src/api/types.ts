export type Sentiment = "positive" | "neutral" | "negative";
export type Priority = "critical" | "high" | "medium" | "low";

export interface Me { id: string; email: string; full_name: string; role: string; permissions: string[] }

export interface FeedbackItem {
  id: string; platform: string; platform_name: string; author: string; content: string; rating: number | null; language: string;
  created_at: string; is_sample: boolean; review_status: string; action_status: string; sentiment: Sentiment; ai_sentiment: Sentiment;
  score: number; confidence: number; possible_sarcasm: boolean; emotion: string; intent: string; topics: string[]; topic: string;
  priority: Priority; engine: string;
}
export interface ReviewEntry { field: string; original: string; corrected: string; note: string; reviewer: string; at: string }
export interface FeedbackDetail extends FeedbackItem {
  reason: string; recommended_action: string; intent_reason: string; priority_reason: string;
  ai: { sentiment: string; emotion: string; intent: string; priority: string }; emotion_scores: Record<string, number>;
  model_version: string; analyzed_at: string | null; source_url: string | null; external_id: string | null; parent_reference: string | null;
  collected_at: string; reviews: ReviewEntry[];
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
export interface ReportRow { id: number; report_type: string; name: string; file_format: string; period: { from: string; to: string }; created_at: string }
export interface UserRow { id: string; email: string; full_name: string; role: string; is_active: boolean; last_login_at: string | null; created_at: string }
export interface AuditRow { id: number; actor: string; action: string; entity: string; entity_id: string; details: any; ip: string; created_at: string }
export interface SettingsData {
  sentiment_thresholds: { negative_max: number; positive_min: number };
  confidence_thresholds: { high: number; moderate: number };
  ai_provider: { provider: string; claude_model: string; api_key_set: boolean };
  alerts: { negative_spike_pct: number; repeated_complaint_count: number; unresolved_days: number; email_enabled: boolean };
  retention: { feedback_days: number; audit_days: number };
}
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
}
