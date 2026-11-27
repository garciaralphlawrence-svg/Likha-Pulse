import type { Status } from "../quote/workflow";
export { peso } from "../quote/engine";

export const fmtDate = (iso?: string | null, time = true) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) + (time ? " · " + d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }) : "");
};
export const ago = (iso: string) => {
  const s = (Date.now() - +new Date(iso)) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)}d ago`;
  return fmtDate(iso, false);
};
export const nowIso = () => new Date().toISOString();

/** Colour family for each status (ink = in progress, gold = needs someone, green = done, red = closed). */
export const STATUS_TONE: Record<Status, "slate" | "gold" | "green" | "red" | "blue"> = {
  new: "gold", ai_recommended: "gold", offer_drafted: "slate", pending_approval: "blue", changes_requested: "gold",
  approved: "green", sent: "green", accepted: "green", booked: "green", declined: "red", lost: "red",
};
