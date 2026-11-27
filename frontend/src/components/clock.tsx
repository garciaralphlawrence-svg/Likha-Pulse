// Response Clock pieces: one colour language for cases, quotation requests and unanswered messages.
import clsx from "clsx";
import { Check, Copy, MessageSquareQuote } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../lib/auth";
import { ClockInfo, OPEN_STAGES, STAGES, Stage, dur, usedShare } from "../quote/clock";
import { REPLY_LANGUAGES, REPLY_SITUATIONS, fillReply, type ReplyTemplate } from "../quote/care";

/** Re-renders every 30 seconds so the clocks keep moving. */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => { const t = setInterval(() => setNow(new Date().toISOString()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export function StagePill({ stage, small }: { stage: Stage; small?: boolean }) {
  const s = STAGES[stage];
  return (
    <span className={clsx("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-semibold uppercase tracking-[0.08em]", small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]")} style={{ background: s.soft, color: s.color }}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", (stage === "red" || stage === "overdue") && "animate-pulse")} style={{ background: s.color }} />{s.label}
    </span>
  );
}

/** Time left on a clock, in plain words. */
export function timeLeft(due: string, now: string) {
  const left = +new Date(due) - +new Date(now);
  return left >= 0 ? `${dur(left)} left` : `overdue by ${dur(-left)}`;
}

/** Colour chip + time left for "the customer is waiting on us". */
export function ClockChip({ clock, now }: { clock: ClockInfo; now: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" title={`${clock.label}: waiting since ${new Date(clock.opened_at).toLocaleString("en-PH")}`}>
      <StagePill stage={clock.stage} small />
      <span className="text-[11px] font-medium" style={{ color: STAGES[clock.stage].color }}>{clock.label}: {timeLeft(clock.due_at, now)}</span>
    </span>
  );
}

/** The track: four coloured quarters, with how much of the time is used. */
export function ClockTrack({ opened, due, resolved, now, thick }: { opened: string; due: string; resolved: string | null; now: string; thick?: boolean }) {
  const used = usedShare(opened, due, resolved ?? now);
  const f = (+new Date(resolved ?? now) - +new Date(opened)) / Math.max(1, +new Date(due) - +new Date(opened));
  const stage: Stage = resolved ? "solved" : f >= 1 ? "overdue" : f >= 0.75 ? "red" : f >= 0.5 ? "orange" : f >= 0.25 ? "yellow" : "green";
  return (
    <div className={clsx("relative w-full overflow-hidden rounded-full bg-ivory-200", thick ? "h-3" : "h-2")} aria-hidden>
      <div className="absolute inset-0 flex opacity-[0.22]">{(["green", "yellow", "orange", "red"] as Stage[]).map((k) => <div key={k} className="h-full flex-1" style={{ background: STAGES[k].color }} />)}</div>
      <div className={clsx("relative h-full rounded-full transition-[width] duration-700", stage === "overdue" && "animate-pulse")} style={{ width: `${Math.max(3, used * 100)}%`, background: STAGES[stage].color }} />
      {[25, 50, 75].map((p) => <span key={p} className="absolute top-0 h-full w-px bg-white/80" style={{ left: `${p}%` }} />)}
    </div>
  );
}

/** Counts per colour, used on the Overview and the Response Clock page. */
export function ClockStrip({ title, counts, to, note }: { title: string; counts: Record<string, number>; to?: string; note?: string }) {
  const total = OPEN_STAGES.reduce((s, k) => s + (counts[k] ?? 0), 0);
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-xl font-semibold text-ink-900">{title}</p>
        {to ? <Link to={to} className="text-sm text-gold-700 hover:underline">{total} open · see all</Link> : <span className="text-sm text-ink-400">{total} open</span>}
      </div>
      <div className="mt-3 flex h-3 gap-[2px] overflow-hidden rounded-full bg-ivory-200" role="img" aria-label={OPEN_STAGES.map((k) => `${counts[k] ?? 0} ${STAGES[k].label}`).join(", ")}>
        {OPEN_STAGES.filter((k) => counts[k]).map((k) => <div key={k} className="bar-grow h-full" style={{ flexGrow: counts[k], background: STAGES[k].color }} title={`${counts[k]} ${STAGES[k].label}`} />)}
      </div>
      <ul className="mt-3 grid grid-cols-5 gap-1 text-center">
        {OPEN_STAGES.map((k) => (
          <li key={k} className="rounded-lg px-1 py-1.5" style={{ background: STAGES[k].soft }}>
            <span className="block font-display text-xl font-semibold leading-none" style={{ color: STAGES[k].color }}>{counts[k] ?? 0}</span>
            <span className="mt-0.5 block truncate text-[10px] text-ink-500">{STAGES[k].label}</span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-2 text-xs text-ink-400">{note}</p>}
    </div>
  );
}

/** Ready replies for one situation, English and Taglish. Copy only; nothing is sent automatically. */
export function SuggestedReplies({ situation, ctx, onReplied, repliedLabel = "I replied" }: { situation: string; ctx: { name?: string; range?: string; ref?: string; valid?: string }; onReplied?: () => void; repliedLabel?: string }) {
  const { can } = useAuth();
  const [all, setAll] = useState<ReplyTemplate[] | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  useEffect(() => { api.replyTemplates().then(setAll).catch(() => setAll([])); }, []);
  const list = (all ?? []).filter((t) => t.situation === situation);
  const copy = async (t: ReplyTemplate) => {
    try { await navigator.clipboard.writeText(fillReply(t.body, ctx)); } catch { /* clipboard blocked: the text is still visible to copy by hand */ }
    setCopied(t.id); setTimeout(() => setCopied(null), 1800);
  };
  return (
    <div className="rounded-2xl border border-ivory-200 bg-ivory-50 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-ink-800"><MessageSquareQuote className="h-4 w-4 text-gold-600" />Suggested replies: {REPLY_SITUATIONS[situation] ?? situation}</p>
      <ul className="mt-3 space-y-2">
        {list.map((t) => (
          <li key={t.id} className="rounded-xl border border-ivory-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{t.title}</span><span className="text-[11px] text-ink-400">{REPLY_LANGUAGES[t.language]}</span></div>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-600">{fillReply(t.body, ctx)}</p>
            <button className="btn-ghost mt-1 px-2 py-1 text-xs text-gold-700" onClick={() => copy(t)}>{copied === t.id ? <><Check className="h-3.5 w-3.5" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}</button>
          </li>
        ))}
        {all && !list.length && <li className="text-sm text-ink-400">No saved replies for this situation yet.{can("replies.manage") && <> Add one in <Link className="underline" to="/staff/replies">Suggested replies</Link>.</>}</li>}
      </ul>
      {onReplied && <button className="btn-primary mt-3" onClick={onReplied}><Check className="h-4 w-4" />{repliedLabel}</button>}
      <p className="mt-2 text-[11px] text-ink-400">Copy a reply, paste it in Messenger or Facebook, then tap "{repliedLabel}" to stop the reply clock.</p>
    </div>
  );
}
