// Response Clock: every Urgent or Important message becomes a "case" with a deadline.
// The color changes as time runs out (for a 24-hour case, every 6 hours):
//   0-25% of the time used = green, 25-50% = yellow, 50-75% = orange, 75-100% = red, past the deadline = overdue.
// Same rules as backend/app/services/cases.py; the playbooks come from backend/app/services/playbooks.json.
import PLAYBOOKS from "../demo/playbooks.json";

export type Stage = "green" | "yellow" | "orange" | "red" | "overdue" | "solved";

export const STAGES: Record<Stage, { label: string; hint: string; color: string; soft: string }> = {
  green: { label: "On track", hint: "Plenty of time left", color: "#2f7d62", soft: "#e8f3ee" },
  yellow: { label: "Needs progress", hint: "A quarter of the time is gone", color: "#b8901f", soft: "#fbf4dc" },
  orange: { label: "At risk", hint: "Half of the time is gone", color: "#c0672c", soft: "#fbeadf" },
  red: { label: "Due soon", hint: "Less than a quarter of the time left", color: "#b4362a", soft: "#f9e1de" },
  overdue: { label: "Overdue", hint: "The deadline has passed", color: "#7a1f17", soft: "#f3d6d2" },
  solved: { label: "Solved", hint: "Case closed", color: "#5c6b63", soft: "#eef0ee" },
};

export interface ClockSettings { urgent_hours: number; important_hours: number; urgent_reply_minutes: number; important_reply_minutes: number }
export const DEFAULT_CLOCK: ClockSettings = { urgent_hours: 24, important_hours: 48, urgent_reply_minutes: 60, important_reply_minutes: 240 };

export function stageOf(c: { opened_at: string; due_at: string; resolved_at: string | null }, now = Date.now()): Stage {
  if (c.resolved_at) return "solved";
  const a = +new Date(c.opened_at), b = +new Date(c.due_at);
  const f = (now - a) / Math.max(1, b - a);
  return f >= 1 ? "overdue" : f >= 0.75 ? "red" : f >= 0.5 ? "orange" : f >= 0.25 ? "yellow" : "green";
}

/** Share of the time already used, 0..1 (capped). */
export const usedShare = (c: { opened_at: string; due_at: string }, now = Date.now()) =>
  Math.min(1, Math.max(0, (now - +new Date(c.opened_at)) / Math.max(1, +new Date(c.due_at) - +new Date(c.opened_at))));

export function dur(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 48) return r ? `${h}h ${r}m` : `${h}h`;
  const d = Math.floor(h / 24), hh = h % 24;
  return hh ? `${d}d ${hh}h` : `${d}d`;
}

// ---- Travel situations: what kind of problem it is, and a ready playbook for the team ----
export const SITUATIONS: Record<string, { label: string; steps: string[] }> = PLAYBOOKS.situations;

const has = (t: string, words: string[]) => words.some((w) => t.includes(w));

export function situationOf(text: string, topic: string): string {
  const t = text.toLowerCase();
  if (has(t, ["passport", "pasaporte"]) && has(t, ["nawala", "lost", "naiwan", "missing", "ninakaw", "stolen"])) return "documents";
  if (topic === "Safety & Health" || has(t, ["stranded", "naiwan", "aksidente", "naaksidente", "accident", "food poisoning", "lagnat", "nilalagnat", "emergency", "unsafe"])) return "emergency";
  if (has(t, ["confirmation", "e-ticket", "booking ko", "booking namin"]) && !has(t, ["refund", "charged"])) return "booking";
  if (topic === "Payment & Refunds" || has(t, ["refund", "charged", "gcash", "bayad"])) return "refund";
  if (topic === "Flights & Transfers" || has(t, ["flight", "sundo", "pickup", "pick up", "airport", "van", "transfer"])) return "transfer";
  if (topic === "Hotels & Accommodation" || has(t, ["hotel", "resort", "room"])) return "hotel";
  if (topic === "Visa & Travel Documents" || has(t, ["visa", "embassy"])) return "visa";
  if (topic === "Booking & Reservations" || has(t, ["booking", "confirmation", "ticket", "reservation"])) return "booking";
  if (["Tours & Itinerary", "Tour Guides & Staff", "Destinations", "Waiting Time & Delays"].includes(topic)) return "tour";
  return "general";
}

/** Signs that the traveler is on the trip right now (so every minute counts). */
export function travelingNow(text: string, situation: string): boolean {
  const t = text.toLowerCase();
  return situation === "emergency" || situation === "documents" || has(t, ["dito sa", "nandito", "right now", "ngayon", "stranded", "naiwan", "sa hotel", "sa airport"]);
}
