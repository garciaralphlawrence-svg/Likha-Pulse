import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { api, IS_DEMO } from "../api";
import type { SettingsData } from "../api/types";
import { Card, ErrorBox, PageHeader, Spinner, Tag } from "../components/ui";
import { useAsync } from "../lib/useAsync";

function Num({ label, value, onChange, step = 1, hint }: { label: string; value: number; onChange: (n: number) => void; step?: number; hint?: string }) {
  return <label className="block"><span className="label">{label}</span><input type="number" step={step} className="input" value={value} onChange={(e) => onChange(Number(e.target.value))} />{hint && <span className="text-xs text-ink-400">{hint}</span>}</label>;
}

export default function Settings() {
  const { data, loading, error } = useAsync(() => api.settings(), []);
  const [s, setS] = useState<SettingsData | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => { if (data) setS(structuredClone(data)); }, [data]);
  const save = async (key: keyof SettingsData) => {
    setErr(null); setSaved(null);
    try { await api.saveSetting(key, s![key] as any); setSaved(key); setTimeout(() => setSaved(null), 2500); } catch (e) { setErr(e); }
  };
  const put = <K extends keyof SettingsData>(k: K, patch: Partial<SettingsData[K]>) => setS((p) => p && ({ ...p, [k]: { ...p[k], ...patch } }));
  const SaveBtn = ({ k }: { k: keyof SettingsData }) => <button className="btn-secondary" onClick={() => save(k)}><Save className="h-4 w-4" />{saved === k ? "Saved" : "Save"}</button>;
  if (loading || !s) return <><PageHeader eyebrow="Settings" title="Settings" /><ErrorBox error={error} />{!error && <Spinner />}</>;
  return (
    <>
      <PageHeader eyebrow="Settings" title="How the AI works for you" description="Most businesses never need to change these. They are here if you want the AI to be stricter or to alert you sooner." />
      <ErrorBox error={err} />
      <div className="mt-3 grid gap-5 lg:grid-cols-2">
        <Card title="When is a customer happy or unhappy?" subtitle="The AI rates each message from −100 (very unhappy) to +100 (very happy)" action={<SaveBtn k="sentiment_thresholds" />}>
          <div className="grid grid-cols-2 gap-3">
            <Num label="Unhappy at or below" value={s.sentiment_thresholds.negative_max} onChange={(n) => put("sentiment_thresholds", { negative_max: n })} />
            <Num label="Happy at or above" value={s.sentiment_thresholds.positive_min} onChange={(n) => put("sentiment_thresholds", { positive_min: n })} />
          </div>
          <p className="mt-2 text-xs text-ink-400">Anything in between is neutral. Recommended: −25 and +25.</p>
        </Card>
        <Card title="When should your team double-check?" subtitle="The AI flags messages it is not sure about" action={<SaveBtn k="confidence_thresholds" />}>
          <div className="grid grid-cols-2 gap-3">
            <Num label="AI is confident from" step={0.01} value={s.confidence_thresholds.high} onChange={(n) => put("confidence_thresholds", { high: n })} hint="e.g. 0.90" />
            <Num label="Ask the team below" step={0.01} value={s.confidence_thresholds.moderate} onChange={(n) => put("confidence_thresholds", { moderate: n })} hint="e.g. 0.70" />
          </div>
        </Card>
        <Card title="Which AI reads your messages" action={<SaveBtn k="ai_provider" />}>
          <div className="space-y-3 text-sm">
            <label className="flex items-start gap-2"><input type="radio" checked={s.ai_provider.provider === "rule"} onChange={() => put("ai_provider", { provider: "rule" })} className="mt-1" />
              <span><b>Likha AI (included, free)</b><span className="block text-xs text-ink-400">Understands English, Tagalog and Taglish, including “pero”, “hindi” and common sarcasm.</span></span></label>
            <label className="flex items-start gap-2"><input type="radio" checked={s.ai_provider.provider === "claude"} onChange={() => put("ai_provider", { provider: "claude" })} className="mt-1" disabled={!s.ai_provider.api_key_set} />
              <span><b>Claude premium AI</b> {s.ai_provider.api_key_set ? <Tag tone="green">Ready</Tag> : <Tag>Not set up</Tag>}
                <span className="block text-xs text-ink-400">Even better at sarcasm and tricky messages. Small cost per message; Likha Studio sets it up for you.{IS_DEMO && " Not available in this preview."}</span></span></label>
            
          </div>
        </Card>
        <Card title="When should we alert you?" action={<SaveBtn k="alerts" />}>
          <div className="grid grid-cols-3 gap-3">
            <Num label="Unhappy rises by (%)" value={s.alerts.negative_spike_pct} onChange={(n) => put("alerts", { negative_spike_pct: n })} hint="compared with last week" />
            <Num label="Same complaint" value={s.alerts.repeated_complaint_count} onChange={(n) => put("alerts", { repeated_complaint_count: n })} hint="times in a week" />
            <Num label="No reply after (days)" value={s.alerts.unresolved_days} onChange={(n) => put("alerts", { unresolved_days: n })} />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={s.alerts.email_enabled} onChange={(e) => put("alerts", { email_enabled: e.target.checked })} />Also send urgent alerts by email</label>
        </Card>
        <Card title="Response clock" subtitle="How fast urgent and important cases must be handled" action={<SaveBtn k="response_clock" />}>
          {(() => { const rc = { urgent_hours: 24, important_hours: 48, urgent_reply_minutes: 60, important_reply_minutes: 240, ...(s.response_clock ?? {}) }; const setRc = (p: Partial<typeof rc>) => setS((x) => x && ({ ...x, response_clock: { ...rc, ...p } })); return (
            <div className="grid grid-cols-2 gap-3">
              <Num label="Solve urgent within (hours)" value={rc.urgent_hours} onChange={(n) => setRc({ urgent_hours: n })} />
              <Num label="Solve important within (hours)" value={rc.important_hours} onChange={(n) => setRc({ important_hours: n })} />
              <Num label="First reply to urgent (minutes)" value={rc.urgent_reply_minutes} onChange={(n) => setRc({ urgent_reply_minutes: n })} />
              <Num label="First reply to important (minutes)" value={rc.important_reply_minutes} onChange={(n) => setRc({ important_reply_minutes: n })} />
            </div>); })()}
          <p className="mt-2 text-xs text-ink-400">Colors change every quarter of the time: green, yellow, orange, red, then overdue. New deadlines apply to new cases.</p>
        </Card>
        <Card title="How long to keep messages" action={<SaveBtn k="retention" />}>
          <div className="grid grid-cols-2 gap-3">
            <Num label="Keep messages (days)" value={s.retention.feedback_days} onChange={(n) => put("retention", { feedback_days: n })} />
            <Num label="Keep activity history (days)" value={s.retention.audit_days} onChange={(n) => put("retention", { audit_days: n })} />
          </div>
          <p className="mt-2 text-xs text-ink-400">Older records are removed automatically every night.</p>
        </Card>
      </div>
    </>
  );
}
