export const SENT_COLORS: Record<string, string> = { positive: "#1f9d6b", neutral: "#8a94a6", negative: "#d64545" };
export const PRIO_COLORS: Record<string, string> = { critical: "#b42318", high: "#e8590c", medium: "#d4a017", low: "#64748b" };
export const PLATFORM_LABEL: Record<string, string> = { google_business: "Google", facebook_page: "Facebook", messenger: "Messenger", manual: "Manual" };
export const pretty = (s?: string | null) => (s ? s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "—");
export const fmtDate = (iso?: string | null, time = true) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) + (time ? " " + d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }) : "");
};
export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export function presetRange(days: number): { date_from: string; date_to: string } {
  const to = new Date();
  return { date_from: isoDay(new Date(+to - days * 86400000)), date_to: isoDay(to) };
}
