// Talks to the FastAPI backend.
import type { Api, Me } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const TOKEN_KEY = "paph.token";

let token: string | null = (() => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } })();

export class ApiError extends Error { status: number; constructor(status: number, msg: string) { super(msg); this.status = status; } }

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, { ...init, headers });
  if (r.status === 401 && token) { token = null; try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } }
  if (!r.ok) {
    let msg = r.statusText;
    try { const j = await r.json(); msg = typeof j.detail === "string" ? j.detail : Array.isArray(j.detail) ? j.detail.map((d: { msg: string }) => d.msg).join("; ") : msg; } catch { /* ignore */ }
    throw new ApiError(r.status, msg);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}
const post = <T>(path: string, body?: unknown) => req<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const q = (o: Record<string, string>) => "?" + new URLSearchParams(o).toString();

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
  submitRequest: (r) => post("/api/public/requests", r),
  track: (ref, contact) => req(`/api/public/requests/${encodeURIComponent(ref)}${q({ contact })}`),
  customerAction: (ref, contact, action, note) => post(`/api/public/requests/${encodeURIComponent(ref)}/actions`, { contact, action, note: note ?? "" }),
  dashboard: () => req("/api/dashboard"),
  requests: (view) => req(`/api/requests${q({ view })}`),
  request: (id) => req(`/api/requests/${id}`),
  act: (id, action, payload) => post(`/api/requests/${id}/actions`, { action, ...payload }),
  staff: () => req("/api/staff"),
  settings: () => req("/api/settings"),
  saveSettings: (s) => req("/api/settings", { method: "PUT", body: JSON.stringify(s) }),
  users: () => req("/api/users"),
  createUser: (u) => post("/api/users", u),
  updateUser: (id, patch) => req(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  audit: (page = 1) => req(`/api/audit${q({ page: String(page) })}`),
};
