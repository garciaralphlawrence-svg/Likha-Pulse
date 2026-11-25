// Talks to the FastAPI backend.
import type { Api, Filters, Me } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const TOKEN_KEY = "pulse.token";

let token: string | null = (() => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } })();

export class ApiError extends Error { status: number; constructor(status: number, msg: string) { super(msg); this.status = status; } }

function qs(f: Filters = {}, extra: Record<string, unknown> = {}): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, { ...init, headers });
  if (r.status === 401 && token) { token = null; try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } }
  if (!r.ok) {
    let msg = r.statusText;
    try { const j = await r.json(); msg = typeof j.detail === "string" ? j.detail : Array.isArray(j.detail) ? j.detail.map((d: any) => d.msg).join("; ") : msg; } catch { /* ignore */ }
    throw new ApiError(r.status, msg);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}
const post = <T>(path: string, body?: unknown) => req<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const serverApi: Api = {
  mode: "server",
  async login(email, password) {
    const r = await post<{ access_token: string; user: Me }>("/api/auth/login", { email, password });
    token = r.access_token;
    try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
    return r.user;
  },
  logout() { token = null; try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
  async me() { if (!token) return null; try { return await req<Me>("/api/auth/me"); } catch { return null; } },
  dashboard: (f, g) => req(`/api/dashboard${qs(f, { granularity: g })}`),
  feedback: (f, page, page_size) => req(`/api/feedback${qs(f, { page, page_size })}`),
  feedbackDetail: (id) => req(`/api/feedback/${id}`),
  addFeedback: (content, author, rating) => post("/api/feedback", { content, author: author || null, rating: rating ?? null }),
  review: (id, body) => post(`/api/feedback/${id}/review`, body),
  setStatus: (id, action_status) => req(`/api/feedback/${id}/status`, { method: "PATCH", body: JSON.stringify({ action_status }) }),
  reanalyze: (id) => post(`/api/feedback/${id}/reanalyze`),
  analyze: (text, rating) => post("/api/analyze", { text, rating: rating ?? null }),
  generateInsight: (f) => post(`/api/insights/generate${qs(f)}`),
  insights: () => req("/api/insights"),
  integrations: () => req("/api/integrations"),
  sync: (code) => post(`/api/integrations/${code}/sync`),
  loadSample: () => post("/api/sample-data"),
  clearSample: () => req("/api/sample-data", { method: "DELETE" }),
  notifications: () => req("/api/notifications"),
  markRead: (id) => post(`/api/notifications/${id}/read`),
  markAllRead: () => post("/api/notifications/read-all"),
  reportTypes: () => req("/api/reports/types"),
  reports: () => req("/api/reports"),
  createReport: (report_type, file_format, f) => post(`/api/reports${qs(f)}`, { report_type, file_format }),
  async downloadReport(r) {
    const res = await fetch(`${BASE}/api/reports/${r.id}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new ApiError(res.status, "Download failed");
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${r.report_type}-${r.created_at.slice(0, 10)}.${r.file_format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  users: () => req("/api/users"),
  createUser: (u) => post("/api/users", u),
  updateUser: (id, patch) => req(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  settings: () => req("/api/settings"),
  saveSetting: (key, value) => req(`/api/settings/${key}`, { method: "PUT", body: JSON.stringify(value) }),
  audit: (action, page = 1) => req(`/api/audit${qs({}, { action, page })}`),
};
