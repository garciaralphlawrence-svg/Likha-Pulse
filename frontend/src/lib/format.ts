// Plain-language labels: no technical words in the interface.
export const SENT_COLORS: Record<string, string> = { positive: "#2f7d62", neutral: "#a99f8f", negative: "#b4544a" };
export const PRIO_COLORS: Record<string, string> = { critical: "#9f2f25", high: "#c0672c", medium: "#b8975a", low: "#8a8f99" };

export const MOOD: Record<string, string> = { positive: "Happy", neutral: "Neutral", negative: "Unhappy" };
export const URGENCY: Record<string, string> = { critical: "Urgent", high: "Important", medium: "Follow up", low: "No rush" };
export const FEELING: Record<string, string> = {
  happiness: "Happy", satisfaction: "Satisfied", appreciation: "Grateful", anger: "Angry", frustration: "Frustrated",
  disappointment: "Disappointed", sadness: "Sad", confusion: "Confused", concern: "Worried", excitement: "Excited", neutral: "Calm",
};
export const PURPOSE: Record<string, string> = {
  complaint: "Complaint", compliment: "Praise", inquiry: "Question", suggestion: "Suggestion", request_assistance: "Needs help",
  general_feedback: "Feedback", reported_problem: "Problem", appreciation: "Thank you", follow_up_request: "Still waiting",
};
const PURPOSE_PHRASE: Record<string, string> = {
  complaint: "is complaining about", compliment: "is praising", inquiry: "is asking about", suggestion: "has a suggestion about",
  request_assistance: "needs help with", general_feedback: "shared thoughts on", reported_problem: "reports a problem with",
  appreciation: "is thanking you for", follow_up_request: "is still waiting on",
};
export const PLATFORM_LABEL: Record<string, string> = { google_business: "Google Review", facebook_page: "Facebook Comment", messenger: "Messenger Chat", manual: "Added by staff" };

export const pretty = (s?: string | null) => (s ? s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "—");
export const label = (map: Record<string, string>, v?: string | null) => (v ? map[v] ?? pretty(v) : "—");

/** One sentence that explains the message, e.g. "Frustrated customer is complaining about response time." */
export function headline(m: { emotion: string; intent: string; topic: string; sentiment: string }): string {
  const feel = m.emotion === "neutral" ? "" : FEELING[m.emotion] ?? "";
  const who = feel ? `${feel} customer` : "A customer";
  const topic = !m.topic || m.topic === "General" ? "" : m.topic.toLowerCase().replace(" & ", " and ");
  if (m.intent === "follow_up_request") return `${who} is still waiting for an answer${topic && topic !== "response time" ? ` about ${topic}` : ""}.`;
  if (m.intent === "inquiry" && !topic) return `${who} has a question.`;
  return `${who} ${PURPOSE_PHRASE[m.intent] ?? "shared thoughts on"} ${topic || "your service"}.`;
}

/** How sure the AI is, in words. */
export const sureness = (c: number, moderate = 0.7, high = 0.9) => (c >= high ? "AI is confident" : c >= moderate ? "AI is fairly sure" : "Please double-check");

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
export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export function presetRange(days: number): { date_from: string; date_to: string } {
  const to = new Date();
  return { date_from: isoDay(new Date(+to - days * 86400000)), date_to: isoDay(to) };
}
