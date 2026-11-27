// Weekly report: what the owner receives by email every Monday morning, plus who gets it and an on/off switch.
import { Mail, Save, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { api, IS_DEMO } from "../api";
import { Card, ErrorBox, PageHeader, Spinner, Tag } from "../components/ui";
import { useAuth } from "../lib/auth";
import { fmtDate } from "../lib/format";
import { mins } from "../lib/teamtools";
import { useAsync } from "../lib/useAsync";

export default function WeeklyReport() {
  const { can } = useAuth();
  const { data: d, error, loading, reload } = useAsync(() => api.weeklyReport(), []);
  const [enabled, setEnabled] = useState(true);
  const [to, setTo] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (d) { setEnabled(d.enabled); setTo(d.recipients_setting); } }, [d]);
  const owner = can("settings.manage");

  const save = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try { await api.saveSetting("weekly_report", { enabled, recipients: to }); setMsg("Saved."); await reload(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const sendNow = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try { const r = await api.sendWeeklyReport(); setMsg(r.detail); } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader eyebrow="Weekly report" title="Your Monday morning email"
        description="Every Monday at 8:00 AM, the owner gets a short email: how the week went, what travelers complained about, the Response Clock, watch words and the team." />
      <ErrorBox error={error || err} />
      {msg && <div className="mb-4 rounded-2xl border border-ivory-300 bg-white px-4 py-3 text-sm text-ink-700">{msg}</div>}
      {loading && !d ? <Spinner /> : d && (
        <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <div>
            <p className="eyebrow mb-2">Preview of this week's email</p>
            <article className="overflow-hidden rounded-3xl border border-ivory-200 bg-ivory-50 shadow-lift">
              <div className="border-b border-ivory-200 bg-white px-6 py-3 text-xs text-ink-500">
                <p><span className="text-ink-400">To:</span> {d.recipients.join(", ") || "—"}</p>
                <p className="mt-0.5"><span className="text-ink-400">Subject:</span> <span className="font-medium text-ink-800">{d.subject}</span></p>
              </div>
              <div className="relative overflow-hidden bg-ink-950 p-7 text-ivory-100">
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold-500/15 blur-3xl" />
                <p className="relative text-[11px] uppercase tracking-[0.24em] text-gold-300">Likha Pulse · Weekly report</p>
                <p className="relative mt-2 font-display text-[28px] leading-tight text-ivory-50">{d.verdict}</p>
              </div>
              <div className="space-y-5 p-6 text-[15px] text-ink-700">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[["Messages", d.kpis.total], ["Happy", `${d.kpis.positive_pct}%`], ["Unhappy", `${d.kpis.negative_pct}%`], ["Need an answer", d.kpis.urgent_open]].map(([k, v]) => (
                    <div key={String(k)} className="rounded-2xl bg-white p-3 ring-1 ring-ivory-200"><p className="text-[10px] uppercase tracking-[0.16em] text-ink-400">{k}</p><p className="font-display text-2xl font-semibold text-ink-900">{v}</p></div>
                  ))}
                </div>
                <p>Response Clock: <b>{d.clock.open}</b> open, <b>{d.clock.overdue}</b> overdue, <b>{d.clock.solved}</b> solved this week{d.clock.on_time_pct !== null && ` (${d.clock.on_time_pct}% on time)`}.</p>
                {d.top_complaints.length > 0 && <p><b>Most complaints:</b> {d.top_complaints.map((t) => t.topic).join(", ")}</p>}
                {d.most_appreciated.length > 0 && <p><b>Most loved:</b> {d.most_appreciated.map((t) => t.topic).join(", ")}</p>}
                {d.watch.length > 0 && <p><b>Watch words:</b> {d.watch.map((w) => `${w.word} (${w.count})`).join(", ")}</p>}
                {d.team.length > 0 && (
                  <div><p className="font-semibold">Team</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">{d.team.map((t) => <li key={t.name}>{t.name}: {t.handled} handled, first reply {mins(t.avg_first_reply_minutes)}</li>)}</ul>
                  </div>
                )}
                {d.actions.length > 0 && (
                  <div className="rounded-2xl border border-gold-300 bg-gold-50 p-4">
                    <p className="font-semibold text-gold-700">This week</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">{d.actions.map((a) => <li key={a}>{a}</li>)}</ul>
                  </div>
                )}
                {d.kpis.sample_count > 0 && <p className="text-xs text-ink-400">Note: {d.kpis.sample_count} of these are sample messages, not real travelers.</p>}
              </div>
            </article>
          </div>

          <div className="space-y-5">
            <Card title="Sending" subtitle={d.schedule} action={d.enabled ? <Tag tone="green">On</Tag> : <Tag>Off</Tag>}>
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-gold-500" checked={enabled} disabled={!owner} onChange={(e) => setEnabled(e.target.checked)} />Send the weekly report every Monday</label>
                <label className="block"><span className="label">Send to</span>
                  <input className="input" value={to} disabled={!owner} onChange={(e) => setTo(e.target.value)} placeholder="Leave empty to send to the owner account" />
                  <span className="text-xs text-ink-400">Separate more than one email with commas.</span></label>
                {owner && <div className="flex flex-wrap gap-2">
                  <button className="btn-primary" disabled={busy} onClick={save}><Save className="h-4 w-4" />Save</button>
                  <button className="btn-secondary" disabled={busy} onClick={sendNow}><Send className="h-4 w-4" />Send now</button>
                </div>}
                <p className="flex items-start gap-2 text-xs text-ink-400"><Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {IS_DEMO ? "This preview cannot send email. In your live system, Likha Studio connects your email account so the report arrives every Monday."
                    : d.email_ready ? `Email is set up.${d.last_sent_week ? ` Last sent: week ${d.last_sent_week}.` : ""}` : "Email is not set up on the server yet. Likha Studio adds it during setup; until then the report is only shown here."}</p>
              </div>
            </Card>
            <Card title="What's inside">
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-600">
                <li>One line on how the week went</li>
                <li>Number of messages, happy and unhappy share</li>
                <li>Response Clock: open, overdue and solved cases</li>
                <li>Top complaints and what travelers loved</li>
                <li>Messages with your watch words</li>
                <li>How fast each team member replied</li>
              </ul>
              <p className="mt-3 text-xs text-ink-400">Covers the 7 days up to {fmtDate(d.period.to)}.</p>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
