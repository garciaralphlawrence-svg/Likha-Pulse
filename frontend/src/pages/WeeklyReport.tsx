import { Mail, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { Settings } from "../api/types";
import { Card, ErrorBox, PageHeader, Spinner } from "../components/ui";
import { peso } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { dur } from "../quote/clock";

/** Preview of the email the owner gets every Monday at 8 AM (Philippine time), plus its on/off and recipients. */
export default function WeeklyReport() {
  const { data: w, loading, error, reload } = useAsync(() => api.weeklyReport(), []);
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState<unknown>(null);
  useEffect(() => { api.settings().then(setS).catch(setErr); }, []);
  const save = async () => { setErr(null); setMsg(""); try { setS(await api.saveSettings(s!)); setMsg("Saved."); reload(); } catch (x) { setErr(x); } };
  const send = async () => { setErr(null); try { setMsg((await api.sendWeeklyReport()).detail); } catch (x) { setErr(x); } };
  return (
    <>
      <PageHeader eyebrow="Weekly report" title="Your Monday email" description="A short summary of the week, emailed every Monday at 8:00 AM (Philippine time). Below is exactly what it will say." />
      <ErrorBox error={error || err} />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {loading || !w ? <Spinner /> : (
          <article className="card overflow-hidden">
            <div className="border-b border-ivory-200 bg-ivory-50 px-5 py-3 text-sm text-ink-500"><Mail className="mr-2 inline h-4 w-4" /><b className="text-ink-800">{w.subject}</b></div>
            <div className="space-y-5 p-5 sm:p-6">
              <p className="font-display text-2xl font-semibold leading-snug text-ink-900">{w.verdict}</p>
              <ul className="grid gap-2 text-sm sm:grid-cols-2">
                <li>{w.kpis.messages} customer messages ({w.kpis.positive_pct}% happy, {w.kpis.negative_pct}% unhappy)</li>
                <li>{w.kpis.requests} new quotation requests</li>
                <li>{w.kpis.booked} trips booked ({peso(w.kpis.booked_revenue)})</li>
                <li>{w.clock.open} open cases: {w.clock.red} red, {w.clock.overdue} overdue</li>
                <li>{w.clock.solved} cases solved{w.clock.on_time_pct !== null ? `, ${w.clock.on_time_pct}% on time` : ""}</li>
                <li>{w.clock.requests_overdue} quotation requests waiting too long</li>
              </ul>
              {w.top_complaints.length > 0 && <div><p className="label">Top complaints</p><p className="text-sm">{w.top_complaints.map((t) => `${t.topic} (${t.count})`).join(" · ")}</p></div>}
              {w.most_appreciated.length > 0 && <div><p className="label">Customers liked</p><p className="text-sm">{w.most_appreciated.map((t) => `${t.topic} (${t.count})`).join(" · ")}</p></div>}
              {w.watch.length > 0 && <div><p className="label">Watched words</p><p className="text-sm">{w.watch.map((t) => `${t.word} (${t.count})`).join(" · ")}</p></div>}
              {w.team.length > 0 && <div><p className="label">Team</p><p className="text-sm">{w.team.map((t) => `${t.name}: ${t.handled} handled, first reply ${t.avg_first_reply_minutes === null ? "—" : dur(t.avg_first_reply_minutes * 60000)}`).join(" · ")}</p></div>}
              <div><p className="label">What to do this week</p><ul className="list-disc space-y-1 pl-5 text-sm">{w.actions.map((a) => <li key={a}>{a}</li>)}</ul></div>
            </div>
          </article>
        )}
        {s && (
          <Card title="Settings">
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="accent-[#8c6d36]" checked={s.weekly_enabled} onChange={(e) => setS({ ...s, weekly_enabled: e.target.checked })} />Send the weekly email</label>
            <label className="mt-4 block"><span className="label">Send to</span><input className="input" value={s.weekly_recipients} onChange={(e) => setS({ ...s, weekly_recipients: e.target.value })} placeholder="owner@paph.example, manager@paph.example" /><span className="text-xs text-ink-400">Empty = every owner account. Separate emails with commas.</span></label>
            <div className="mt-4 flex flex-wrap gap-2"><button className="btn-primary" onClick={save}>Save</button><button className="btn-secondary" onClick={send}><Send className="h-4 w-4" />Send now</button></div>
            {msg && <p className="mt-3 rounded-xl bg-ivory-100 px-3 py-2 text-sm text-ink-600">{msg}</p>}
            <p className="mt-4 text-xs text-ink-400">The server sends it through PAPH's email account (SMTP). Until that is set up, it only writes the report to the server log.</p>
          </Card>
        )}
      </div>
    </>
  );
}
