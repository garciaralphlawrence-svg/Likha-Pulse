import clsx from "clsx";
import { BedDouble, CircleCheck, FileWarning, Map, MessageCircle, PencilLine, Plane, RotateCcw, Siren, Stamp, Ticket, UserRound, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { CaseView, ClockStats, Settings, StaffMember } from "../api/types";
import { ClockStrip, ClockTrack, StagePill, SuggestedReplies, timeLeft, useNow } from "../components/clock";
import { Card, Drawer, Empty, ErrorBox, PageHeader, SampleTag, Spinner, Stat, Tag } from "../components/ui";
import { useAuth } from "../lib/auth";
import { fmtDate } from "../lib/format";
import { CaseAction, STAGES, Stage, dur } from "../quote/clock";
import { replyKey } from "../quote/care";
import { DEFAULT_SETTINGS } from "../quote/workflow";

const ICONS: Record<string, typeof Siren> = { emergency: Siren, documents: FileWarning, transfer: Plane, hotel: BedDouble, refund: Wallet, visa: Stamp, booking: Ticket, tour: Map, changes: PencilLine, general: MessageCircle };
const SOURCE: Record<string, string> = { message: "Facebook or Messenger message", request: "Message on a quotation", feedback: "Low after-trip rating", manual: "Opened by staff" };
const minsText = (m: number | null) => (m === null ? "—" : dur(m * 60000));

function Legend({ s }: { s: Settings }) {
  const q = s.urgent_hours / 4;
  const parts: [Stage, string][] = [["green", `0–${q}h`], ["yellow", `${q}–${2 * q}h`], ["orange", `${2 * q}–${3 * q}h`], ["red", `${3 * q}–${s.urgent_hours}h`], ["overdue", `after ${s.urgent_hours}h`]];
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-xl font-semibold">How the clock works</p>
        <p className="text-xs text-ink-400">Urgent: solve within {s.urgent_hours}h · Important: within {s.important_hours}h · New quotation requests: first reply within {s.request_reply_hours}h</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {parts.map(([k, range]) => (
          <div key={k} className="rounded-xl px-3 py-2" style={{ background: STAGES[k].soft }}>
            <p className="text-sm font-semibold" style={{ color: STAGES[k].color }}>{STAGES[k].label}</p>
            <p className="text-[11px] text-ink-500">{range} for an urgent case</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-400">At "Due soon" a case is escalated to the owner automatically. The same colours are used for quotation requests and unanswered messages.</p>
    </div>
  );
}

function CaseCard({ c, now, onOpen }: { c: CaseView; now: string; onOpen: () => void }) {
  const Icon = ICONS[c.situation] ?? MessageCircle;
  return (
    <li>
      <button onClick={onOpen} className="w-full rounded-2xl border bg-white p-4 text-left transition hover:shadow-card sm:p-5" style={{ borderColor: c.resolved_at ? "#efe8dc" : STAGES[c.stage].color + "55" }}>
        <div className="flex flex-wrap items-center gap-2">
          <StagePill stage={c.stage} />
          <span className="text-xs font-semibold text-ink-400">{c.id}</span>
          <Tag tone={c.priority === "urgent" ? "red" : "gold"}>{c.priority === "urgent" ? "Urgent" : "Important"}</Tag>
          {c.traveling_now && <Tag tone="blue">On a trip now</Tag>}
          {c.escalated && <Tag tone="red">Escalated to owner</Tag>}
          {c.is_sample && <SampleTag />}
          <span className="ml-auto text-sm font-semibold" style={{ color: STAGES[c.stage].color }}>{c.resolved_at ? `Solved in ${dur(+new Date(c.resolved_at) - +new Date(c.opened_at))}` : timeLeft(c.due_at, now)}</span>
        </div>
        <div className="mt-2 flex gap-3">
          <Icon className="mt-1 h-5 w-5 shrink-0 text-ink-400" />
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold leading-tight text-ink-900">{c.situation_label}: {c.client}</p>
            <p className="mt-0.5 line-clamp-2 text-sm text-ink-500">“{c.text}”</p>
          </div>
        </div>
        <div className="mt-3"><ClockTrack opened={c.opened_at} due={c.due_at} resolved={c.resolved_at} now={now} /></div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400">
          <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{c.owner?.name ?? "Nobody yet"}</span>
          <span>Playbook {c.steps_done}/{c.steps.length}</span>
          <span>{c.first_reply_at ? `First reply after ${dur(+new Date(c.first_reply_at) - +new Date(c.opened_at))}` : c.reply_stage ? <span style={{ color: STAGES[c.reply_stage].color }}>No reply yet ({timeLeft(c.reply_due_at, now)} for the first reply)</span> : "No reply yet"}</span>
          {c.request_ref && <span>{c.request_ref}</span>}
        </div>
      </button>
    </li>
  );
}

export default function ResponseClock() {
  const { user, can } = useAuth();
  const now = useNow();
  const [sp, setSp] = useSearchParams();
  const [view, setView] = useState<"open" | "solved">("open");
  const [data, setData] = useState<{ items: CaseView[]; stats: ClockStats; team: StaffMember[] } | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [err, setErr] = useState<unknown>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const openId = sp.get("open");
  const load = () => api.cases(view).then(setData).catch(setErr);
  useEffect(() => { setData(null); load(); }, [view]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.settings().then(setSettings).catch(() => undefined); }, []);
  const [sel, setSel] = useState<CaseView | null>(null);
  useEffect(() => { if (openId && data) setSel(data.items.find((c) => c.id === openId) ?? sel); }, [openId, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (action: CaseAction, payload: Parameters<typeof api.caseAction>[2] = {}) => {
    if (!sel) return;
    setBusy(true); setErr(null);
    try { const c = await api.caseAction(sel.id, action, payload); setSel(c); setNote(""); load(); } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  const close = () => { setSel(null); setShowReplies(false); sp.delete("open"); setSp(sp, { replace: true }); };
  const s = data?.stats;
  const mine = (c: CaseView) => user?.role === "ADMIN" || c.owner?.id === user?.id;
  return (
    <>
      <PageHeader eyebrow="Response Clock" title={user?.role === "ADMIN" ? "Every customer issue, on the clock" : "Your cases"}
        description={`Urgent issues must be solved within ${settings.urgent_hours} hours. The colour changes every ${settings.urgent_hours / 4} hours without progress: green, yellow, orange, red, then overdue.`} />
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-full border border-ivory-300 bg-white p-1 sm:inline-flex">
        {(["open", "solved"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={clsx("shrink-0 rounded-full px-4 py-2 text-sm", view === v ? "bg-ink-900 text-ivory-50" : "text-ink-500")}>{v === "open" ? "Open cases" : "Solved"}</button>)}
      </div>
      <ErrorBox error={!sel && err} />
      {!data || !s ? <Spinner /> : (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <ClockStrip title="Open cases by colour" counts={s.by_stage} note={`${s.escalated} escalated · ${s.no_reply_yet} without a first reply · ${s.traveling_now} on a trip now`} />
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Solved on time" value={s.on_time_pct === null ? "—" : `${s.on_time_pct}%`} tone="gold" hint={`${s.solved} solved in 90 days`} />
              <Stat label="Average time to solve" value={minsText(s.avg_solve_minutes)} hint={`First reply: ${minsText(s.avg_first_reply_minutes)}`} />
            </div>
          </div>
          {user?.role === "ADMIN" && s.by_person.length > 0 && (
            <Card title="By person" subtitle="Cases solved in the last 90 days">
              <div className="-mx-1 overflow-x-auto px-1"><table className="w-full min-w-[520px] text-sm">
                <thead><tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-400"><th className="pb-2 font-medium">Name</th><th className="pb-2 text-right font-medium">Open</th><th className="pb-2 text-right font-medium">Solved</th><th className="pb-2 text-right font-medium">On time</th><th className="pb-2 text-right font-medium">Avg time to solve</th></tr></thead>
                <tbody>{s.by_person.map((p) => <tr key={p.id} className="border-t border-ivory-200"><td className="py-2">{p.name}</td><td className="py-2 text-right">{p.open}</td><td className="py-2 text-right">{p.solved}</td><td className={clsx("py-2 text-right font-medium", (p.on_time_pct ?? 100) < 70 ? "text-red-800" : "text-emerald-800")}>{p.on_time_pct === null ? "—" : `${p.on_time_pct}%`}</td><td className="py-2 text-right">{minsText(p.avg_solve_minutes)}</td></tr>)}</tbody>
              </table></div>
            </Card>
          )}
          {data.items.length ? <ul className="stagger space-y-3">{data.items.map((c) => <CaseCard key={c.id} c={c} now={now} onOpen={() => { setSel(c); setShowReplies(false); }} />)}</ul> : <Empty title={view === "open" ? "No open cases" : "No solved cases yet"}>{view === "open" ? "Every customer issue is handled." : ""}</Empty>}
          <Legend s={settings} />
        </div>
      )}

      <Drawer open={!!sel} onClose={close} title={sel ? `${sel.situation_label}` : ""}>
        {sel && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2"><StagePill stage={sel.stage} /><span className="text-xs font-semibold text-ink-400">{sel.id}</span><Tag tone={sel.priority === "urgent" ? "red" : "gold"}>{sel.priority === "urgent" ? "Urgent" : "Important"}</Tag>{sel.escalated && <Tag tone="red">Escalated to owner</Tag>}{sel.is_sample && <SampleTag />}</div>
            <div>
              <p className="text-sm text-ink-500">{SOURCE[sel.source]} · <Link className="text-gold-700 underline-offset-2 hover:underline" to={`/staff/clients/${encodeURIComponent(sel.client_key)}`}>{sel.client}</Link>{sel.request_ref && sel.request_id && <> · <Link className="text-gold-700 hover:underline" to={`/staff/requests/${sel.request_id}`}>{sel.request_ref}</Link></>}</p>
              <blockquote className="mt-2 rounded-xl border-l-2 border-gold-500 bg-white px-4 py-3 font-display text-lg italic text-ink-800">“{sel.text}”</blockquote>
            </div>
            <div>
              <ClockTrack opened={sel.opened_at} due={sel.due_at} resolved={sel.resolved_at} now={now} thick />
              <p className="mt-2 text-sm font-semibold" style={{ color: STAGES[sel.stage].color }}>{sel.resolved_at ? `Solved ${fmtDate(sel.resolved_at)} (${sel.on_time ? "on time" : "after the deadline"})` : `${timeLeft(sel.due_at, now)} · due ${fmtDate(sel.due_at)}`}</p>
              <p className="text-xs text-ink-400">Opened {fmtDate(sel.opened_at)} · first reply {sel.first_reply_at ? fmtDate(sel.first_reply_at) : `due ${fmtDate(sel.reply_due_at)}`}</p>
            </div>
            <ErrorBox error={err} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink-500">Handled by</span>
              {user?.role === "ADMIN" ? (
                <select className="input w-auto py-1.5" aria-label="Case owner" value={sel.owner?.id ?? ""} onChange={(e) => { const p = data?.team.find((x) => x.id === e.target.value); if (p) act("assign", { assignee: { id: p.id, name: p.name } }); }}>
                  <option value="" disabled>Choose…</option>
                  {data?.team.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ) : <b className="text-sm">{sel.owner?.name ?? "Nobody yet"}</b>}
              {user?.role !== "ADMIN" && !sel.owner && <button className="btn-secondary py-1.5" disabled={busy} onClick={() => act("assign", { assignee: { id: user!.id, name: user!.full_name } })}>Take this case</button>}
              <label className="ml-auto flex items-center gap-2 text-sm text-ink-600"><input type="checkbox" className="accent-[#8c6d36]" checked={sel.traveling_now} disabled={!mine(sel) || !!sel.resolved_at || busy} onChange={(e) => act("traveling", { value: e.target.checked })} />On a trip now</label>
            </div>
            <div>
              <p className="label">Playbook ({sel.steps_done} of {sel.steps.length} done)</p>
              <ul className="space-y-1.5">
                {sel.steps.map((st, i) => (
                  <li key={i}><label className={clsx("flex cursor-pointer items-start gap-3 rounded-xl border bg-white px-3 py-2.5 text-sm", st.done ? "border-emerald-200 text-ink-400 line-through" : "border-ivory-200 text-ink-800")}>
                    <input type="checkbox" className="mt-0.5 accent-[#2f7d62]" checked={st.done} disabled={!mine(sel) || !!sel.resolved_at || busy} onChange={() => act("step", { index: i })} />{st.text}
                  </label></li>
                ))}
              </ul>
            </div>
            {!sel.resolved_at && mine(sel) && (
              <div className="space-y-3">
                {showReplies ? <SuggestedReplies situation={replyKey(sel.text, sel.source === "feedback" ? "feedback" : "message")} ctx={{ name: sel.client.replace(/^Sample: /, ""), ref: sel.request_ref ?? undefined }} onReplied={() => { act("reply"); setShowReplies(false); }} />
                  : <button className="btn-secondary" onClick={() => setShowReplies(true)}>{sel.first_reply_at ? "Suggested replies" : "Reply to the customer"}</button>}
                <textarea className="input min-h-[70px]" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note or what you did (optional for solving)" aria-label="Note" />
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary" disabled={!note.trim() || busy} onClick={() => act("note", { note })}>Add note</button>
                  <button className="btn-gold" disabled={busy} onClick={() => act("solve", { note })}><CircleCheck className="h-4 w-4" />Mark as solved</button>
                </div>
              </div>
            )}
            {sel.resolved_at && (mine(sel) || can("owner.view")) && <button className="btn-secondary" disabled={busy} onClick={() => act("reopen")}><RotateCcw className="h-4 w-4" />Reopen</button>}
            <div>
              <p className="label">Timeline</p>
              <ol className="space-y-2 border-l border-ivory-300 pl-4">
                {[...sel.updates].reverse().map((u, i) => <li key={i} className="text-sm"><span className="text-ink-800">{u.text}</span><span className="block text-xs text-ink-400">{u.by} · {fmtDate(u.at)}</span></li>)}
              </ol>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
