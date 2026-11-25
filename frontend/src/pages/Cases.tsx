import clsx from "clsx";
import { ArrowUpRight, BedDouble, CircleCheck, FileWarning, Flame, Hourglass, Map, MessageCircle, Plane, Reply, Siren, Stamp, Ticket, Timer, UserRound, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { CaseAction, CaseInfo, CaseStats } from "../api/types";
import CountUp from "../components/CountUp";
import { Drawer, Empty, ErrorBox, PriorityBadge, SampleTag, Spinner } from "../components/ui";
import { useAuth } from "../lib/auth";
import { DEFAULT_CLOCK, SITUATIONS, STAGES, Stage, dur, stageOf, usedShare } from "../lib/clock";
import { PLATFORM_LABEL, ago, fmtDate, headline } from "../lib/format";
import { useAsync } from "../lib/useAsync";

const ICONS: Record<string, typeof Siren> = { emergency: Siren, documents: FileWarning, transfer: Plane, hotel: BedDouble, refund: Wallet, visa: Stamp, booking: Ticket, tour: Map, general: MessageCircle };

/** Re-renders every 30 seconds so the clocks keep moving. */
function useNow(ms = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function timeText(c: CaseInfo, now: number) {
  if (c.resolved_at) return { big: `Solved in ${dur(+new Date(c.resolved_at) - +new Date(c.opened_at))}`, small: +new Date(c.resolved_at) <= +new Date(c.due_at) ? "Within the deadline" : "After the deadline" };
  const left = +new Date(c.due_at) - now;
  return left >= 0 ? { big: `${dur(left)} left`, small: `Due ${fmtDate(c.due_at)}` } : { big: `Overdue by ${dur(-left)}`, small: `Was due ${fmtDate(c.due_at)}` };
}

function StagePill({ stage }: { stage: Stage }) {
  const s = STAGES[stage];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ background: s.soft, color: s.color }}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", (stage === "red" || stage === "overdue") && "animate-pulse")} style={{ background: s.color }} />{s.label}
    </span>
  );
}

/** The 24-hour track: four colored quarters, with a marker for how much time is used. */
function Track({ c, now, thick = false }: { c: CaseInfo; now: number; thick?: boolean }) {
  const used = c.resolved_at ? Math.min(1, usedShare(c, +new Date(c.resolved_at))) : usedShare(c, now);
  const stage = stageOf(c, now);
  const col = STAGES[stage === "solved" ? "solved" : stage].color;
  return (
    <div className={clsx("relative w-full overflow-hidden rounded-full bg-ivory-200", thick ? "h-3" : "h-2")} aria-hidden>
      <div className="absolute inset-0 flex opacity-[0.22]">{(["green", "yellow", "orange", "red"] as Stage[]).map((k) => <div key={k} className="h-full flex-1" style={{ background: STAGES[k].color }} />)}</div>
      <div className={clsx("relative h-full rounded-full transition-[width] duration-700", stage === "overdue" && "animate-pulse")} style={{ width: `${Math.max(3, used * 100)}%`, background: col }} />
      {[25, 50, 75].map((p) => <span key={p} className="absolute top-0 h-full w-px bg-white/80" style={{ left: `${p}%` }} />)}
    </div>
  );
}

function Legend({ hours }: { hours: number }) {
  const q = hours / 4;
  const parts: [Stage, string][] = [["green", `0–${q}h`], ["yellow", `${q}–${2 * q}h`], ["orange", `${2 * q}–${3 * q}h`], ["red", `${3 * q}–${hours}h`]];
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-xl font-semibold text-ink-900">How the clock works</p>
        <p className="text-xs text-ink-400">Urgent: solve within {hours} hours · Important: within {hours * 2} hours</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {parts.map(([k, range]) => (
          <div key={k} className="rounded-xl px-3 py-2.5" style={{ background: STAGES[k].soft }}>
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STAGES[k].color }} /><span className="text-sm font-semibold" style={{ color: STAGES[k].color }}>{STAGES[k].label}</span></div>
            <p className="mt-0.5 text-xs text-ink-500">{range} since the message came in</p>
          </div>
        ))}
        <div className="col-span-2 rounded-xl px-3 py-2.5 sm:col-span-1" style={{ background: STAGES.overdue.soft }}>
          <div className="flex items-center gap-2"><Flame className="h-3.5 w-3.5" style={{ color: STAGES.overdue.color }} /><span className="text-sm font-semibold" style={{ color: STAGES.overdue.color }}>Overdue</span></div>
          <p className="mt-0.5 text-xs text-ink-500">Past {hours}h. The manager is alerted.</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-400">Important cases change color every {hours / 2} hours. At “Due soon”, the case is escalated to the manager automatically.</p>
    </div>
  );
}

function Stats({ s }: { s: CaseStats }) {
  const seg: [Stage, number][] = [["overdue", s.overdue], ["red", s.due_soon], ["orange", s.at_risk], ["yellow", s.needs_progress], ["green", s.on_track]];
  return (
    <section className="relative overflow-hidden rounded-3xl bg-ink-950 p-6 text-ivory-100 shadow-lift sm:p-8">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-gold-500/15 blur-3xl" />
      <div className="relative grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-gold-300"><Timer className="h-3.5 w-3.5" />Right now</p>
          <p className="mt-2 font-display text-[44px] leading-none text-ivory-50"><CountUp value={s.open} /> <span className="text-2xl text-ivory-200/70">open case{s.open === 1 ? "" : "s"} on the clock</span></p>
          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-white/10">
            {seg.filter(([, n]) => n).map(([k, n]) => <div key={k} className="bar-grow h-full" style={{ width: `${(100 * n) / Math.max(1, s.open)}%`, background: STAGES[k].color }} title={`${STAGES[k].label}: ${n}`} />)}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            {seg.map(([k, n]) => <span key={k} className="flex items-center gap-1.5 text-ivory-200/80"><span className="h-2 w-2 rounded-full" style={{ background: STAGES[k].color }} />{STAGES[k].label} <b className="text-ivory-50">{n}</b></span>)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { k: "Travelers on a trip now", v: s.traveling_now, icon: Plane, hot: s.traveling_now > 0 },
            { k: "Waiting for a first reply", v: s.no_reply_yet, icon: Hourglass, hot: s.no_reply_yet > 0 },
            { k: "Solved on time (30 days)", v: s.solved_on_time_pct == null ? "—" : `${s.solved_on_time_pct}%`, icon: CircleCheck },
            { k: "Average first reply", v: s.avg_first_reply_minutes == null ? "—" : dur(s.avg_first_reply_minutes * 60000), icon: Reply },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
              <x.icon className={clsx("h-4 w-4", x.hot ? "text-gold-300" : "text-ivory-200/50")} />
              <p className="mt-2 font-display text-3xl leading-none text-ivory-50">{typeof x.v === "number" ? <CountUp value={x.v} /> : x.v}</p>
              <p className="mt-1 text-xs text-ivory-200/60">{x.k}</p>
            </div>
          ))}
        </div>
      </div>
      {s.avg_solve_minutes != null && <p className="relative mt-5 text-xs text-ivory-200/50">In the last 30 days your team solved {s.solved_30d} cases, on average in {dur(s.avg_solve_minutes * 60000)}.</p>}
    </section>
  );
}

function CaseCard({ c, now, onOpen }: { c: CaseInfo; now: number; onOpen: () => void }) {
  const stage = stageOf(c, now); const st = STAGES[stage]; const Icon = ICONS[c.situation] ?? MessageCircle; const t = timeText(c, now);
  const replyLate = !c.first_reply_at && now > +new Date(c.reply_due_at);
  const done = c.steps.filter((x) => x.done).length;
  return (
    <li>
      <button onClick={onOpen} className="card group relative block w-full min-w-0 overflow-hidden p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lift sm:p-6">
        <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: st.color }} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <StagePill stage={stage} />
            <PriorityBadge value={c.priority} />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ivory-100 px-2.5 py-0.5 text-xs text-ink-700"><Icon className="h-3.5 w-3.5 text-gold-600" />{SITUATIONS[c.situation]?.label}</span>
            {c.traveling_now && !c.resolved_at && <span className="inline-flex items-center gap-1 rounded-full bg-gold-50 px-2 py-0.5 text-xs font-medium text-gold-700 ring-1 ring-gold-300/60"><Plane className="h-3 w-3" />On a trip now</span>}
            {c.escalated && !c.resolved_at && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800"><Flame className="h-3 w-3" />Escalated</span>}
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-semibold leading-none tabular-nums" style={{ color: st.color }}>{t.big}</p>
            <p className="mt-1 text-[11px] text-ink-400">{t.small}</p>
          </div>
        </div>
        <p className="mt-3 line-clamp-2 text-[16px] leading-snug text-ink-900">“{c.content}”</p>
        <div className="mt-4"><Track c={c} now={now} /></div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-ink-500">
          <span className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{c.assignee ?? <span className="font-medium text-red-800">No owner yet</span>}</span>
          {c.first_reply_at
            ? <span className="flex items-center gap-1.5"><Reply className="h-3.5 w-3.5 text-emerald-700" />Replied in {dur(+new Date(c.first_reply_at) - +new Date(c.opened_at))}</span>
            : <span className={clsx("flex items-center gap-1.5", replyLate ? "font-medium text-red-800" : "text-ink-500")}><Hourglass className="h-3.5 w-3.5" />No reply yet{replyLate ? ` · ${dur(now - +new Date(c.opened_at))} waiting` : ` · reply within ${dur(+new Date(c.reply_due_at) - +new Date(c.opened_at))}`}</span>}
          <span>{done}/{c.steps.length} steps done</span>
          <span>Last update {ago(c.last_update_at)}</span>
          <span className="ml-auto">{PLATFORM_LABEL[c.platform] ?? c.platform_name}</span>
        </div>
      </button>
    </li>
  );
}

const UPDATE_ICON: Record<string, string> = { opened: "#a99f8f", assigned: "#b8975a", reply: "#2f7d62", step: "#2f7d62", note: "#6b7280", escalated: "#b4362a", solved: "#2f7d62", reopened: "#c0672c", traveling: "#b8975a" };

function CaseDrawer({ c, team, now, onClose, onChange }: { c: CaseInfo | null; team: string[]; now: number; onClose: () => void; onChange: (c: CaseInfo) => void }) {
  const { can } = useAuth(); const manage = can("feedback.manage");
  const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  useEffect(() => { setNote(""); setErr(null); }, [c?.id]);
  if (!c) return <Drawer open={false} onClose={onClose} title="">{null}</Drawer>;
  const act = async (a: CaseAction) => { setBusy(true); setErr(null); try { onChange(await api.caseAction(c.id, a)); if (a.kind === "note") setNote(""); } catch (e) { setErr(e); } finally { setBusy(false); } };
  const stage = stageOf(c, now); const st = STAGES[stage]; const t = timeText(c, now); const Icon = ICONS[c.situation] ?? MessageCircle;
  const used = c.resolved_at ? 1 : usedShare(c, now); const R = 52, L = 2 * Math.PI * R;
  return (
    <Drawer open onClose={onClose} title={<span className="flex items-center gap-2"><Icon className="h-5 w-5 text-gold-600" />{SITUATIONS[c.situation]?.label}</span>}>
      <ErrorBox error={err} />
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-3xl bg-ink-950 p-6 text-ivory-100 shadow-lift">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl" style={{ background: st.color + "40" }} />
          <div className="relative flex items-center gap-6">
            <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0 -rotate-90" aria-hidden>
              <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="9" />
              <circle cx="60" cy="60" r={R} fill="none" stroke={st.color} strokeWidth="9" strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - Math.max(0.02, used))} style={{ transition: "stroke-dashoffset .8s ease" }} />
            </svg>
            <div className="min-w-0">
              <StagePill stage={stage} />
              <p className="mt-2 font-display text-3xl leading-tight text-ivory-50">{t.big}</p>
              <p className="text-sm text-ivory-200/70">{t.small} · solve within {c.deadline_hours} hours</p>
            </div>
          </div>
          <div className="relative mt-5"><Track c={c} now={now} thick /></div>
        </section>

        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
            <span className="font-medium text-ink-700">{PLATFORM_LABEL[c.platform] ?? c.platform_name}</span><span>·</span><span>{fmtDate(c.opened_at)}</span><PriorityBadge value={c.priority} />{c.is_sample && <SampleTag />}
          </div>
          <blockquote className="mt-3 font-display text-[24px] leading-snug text-ink-900">“{c.content}”</blockquote>
          <p className="mt-2 text-sm text-ink-500"><span className="font-medium text-gold-700">AI:</span> {headline(c.headline)}</p>
          <Link to={`/feedback?open=${c.id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gold-700 hover:underline">Open the full AI review<ArrowUpRight className="h-3.5 w-3.5" /></Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="label">Owner</span>
            <select className="input" disabled={!manage || busy} value={c.assignee ?? ""} onChange={(e) => act({ kind: "assign", assignee: e.target.value })}>
              <option value="">No owner yet</option>{team.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div><span className="label">First reply</span>
            {c.first_reply_at
              ? <p className="flex h-[42px] items-center gap-2 text-sm text-emerald-800"><Reply className="h-4 w-4" />Replied in {dur(+new Date(c.first_reply_at) - +new Date(c.opened_at))}</p>
              : <button className="btn-secondary w-full" disabled={!manage || busy} onClick={() => act({ kind: "reply" })}><Reply className="h-4 w-4" />We replied to the traveler</button>}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" className="accent-gold-500" disabled={!manage || busy} checked={c.traveling_now} onChange={(e) => act({ kind: "traveling", value: e.target.checked })} />The traveler is on the trip right now</label>

        <section>
          <p className="eyebrow mb-2">What to do · travel playbook</p>
          <ul className="space-y-2">
            {c.steps.map((s, i) => (
              <li key={i}>
                <label className={clsx("flex cursor-pointer items-start gap-3 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-ivory-200 transition", s.done && "bg-emerald-50/60 ring-emerald-100")}>
                  <input type="checkbox" className="mt-0.5 accent-emerald-700" disabled={!manage || busy} checked={s.done} onChange={() => act({ kind: "step", index: i })} />
                  <span className={clsx(s.done ? "text-ink-400 line-through" : "text-ink-800")}>{s.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        {manage && (
          <section>
            <p className="eyebrow mb-2">Add an update</p>
            <div className="flex gap-2">
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Called the boat operator, pickup in 30 minutes" onKeyDown={(e) => e.key === "Enter" && note.trim() && act({ kind: "note", text: note })} />
              <button className="btn-secondary shrink-0" disabled={busy || !note.trim()} onClick={() => act({ kind: "note", text: note })}>Add</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {c.resolved_at
                ? <button className="btn-secondary" disabled={busy} onClick={() => act({ kind: "reopen" })}>Reopen case</button>
                : <button className="btn-gold" disabled={busy} onClick={() => act({ kind: "solve" })}><CircleCheck className="h-4 w-4" />Mark as solved</button>}
            </div>
          </section>
        )}

        <section>
          <p className="eyebrow mb-2">Timeline</p>
          <ol className="relative space-y-3 border-l border-ivory-300 pl-5">
            {[...c.updates].reverse().map((u, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-ivory-50" style={{ background: UPDATE_ICON[u.kind] ?? "#a99f8f" }} />
                <p className="text-sm text-ink-800">{u.text}</p>
                <p className="text-[11px] text-ink-400">{u.by} · {fmtDate(u.at)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Drawer>
  );
}

const VIEWS = [{ k: "open", l: "Open cases" }, { k: "solved", l: "Solved" }, { k: "all", l: "All" }] as const;

export default function Cases() {
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<"open" | "solved" | "all">("open");
  const [owner, setOwner] = useState("");
  const [tripOnly, setTripOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(params.get("open"));
  const { data, error, loading, reload, setData } = useAsync(() => api.cases(view), [view]);
  const hours = useAsync(() => api.settings().then((s) => s.response_clock?.urgent_hours ?? DEFAULT_CLOCK.urgent_hours).catch(() => DEFAULT_CLOCK.urgent_hours), []);
  useEffect(() => { const t = setInterval(reload, 120000); return () => clearInterval(t); }, [view]);
  useEffect(() => { const o = params.get("open"); if (o) setOpenId(o); }, [params]);

  const items = useMemo(() => (data?.items ?? []).filter((c) => (!owner || (owner === "none" ? !c.assignee : c.assignee === owner)) && (!tripOnly || c.traveling_now)), [data, owner, tripOnly]);
  const [last, setLast] = useState<CaseInfo | null>(null);
  const current = data?.items.find((c) => c.id === openId) ?? (last?.id === openId ? last : null);
  const close = () => { setOpenId(null); if (params.get("open")) { params.delete("open"); setParams(params); } };
  const onChange = (c: CaseInfo) => { setLast(c); api.cases(view).then(setData).catch(() => undefined); };

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">Response clock</p>
          <h1 className="font-display text-4xl font-semibold leading-tight text-ink-900">Every urgent case, on the clock</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-500">Urgent messages must be solved within {hours.data ?? 24} hours. The color changes as time runs out, so no traveler is ever forgotten.</p>
        </div>
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Spinner /> : data && (
        <div className="space-y-6">
          <Stats s={data.stats} />
          <Legend hours={hours.data ?? 24} />
          <div className="flex flex-wrap items-center gap-2">
            {VIEWS.map((v) => <button key={v.k} onClick={() => setView(v.k)} className={view === v.k ? "btn-primary" : "btn-secondary"}>{v.l}</button>)}
            <select className="input !w-auto" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">
              <option value="">Everyone</option><option value="none">No owner yet</option>{data.team.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <label className="ml-auto flex items-center gap-2 text-sm text-ink-500"><input type="checkbox" className="accent-gold-500" checked={tripOnly} onChange={(e) => setTripOnly(e.target.checked)} />Only travelers on a trip now</label>
          </div>
          {items.length === 0
            ? <Empty title={view === "open" ? "No open cases. Every traveler has been helped." : "Nothing here yet."}>Urgent and important messages appear here automatically.</Empty>
            : <ul className="stagger grid gap-4 xl:grid-cols-2">{items.map((c) => <CaseCard key={c.id} c={c} now={now} onOpen={() => setOpenId(c.id)} />)}</ul>}
        </div>
      )}
      <CaseDrawer c={current} team={data?.team ?? []} now={now} onClose={close} onChange={onChange} />
    </>
  );
}
