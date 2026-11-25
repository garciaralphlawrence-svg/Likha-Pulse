import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { api, IS_DEMO } from "../api";
import type { SettingsData } from "../api/types";
import { Card, ErrorBox, PageHeader, Spinner, Tag } from "../components/ui";
import { useAsync } from "../lib/useAsync";

function Num({ label, value, onChange, step = 1, hint }: { label: string; value: number; onChange: (n: number) => void; step?: number; hint?: string }) {
  return <label className="block"><span className="label">{label}</span><input type="number" step={step} className="input" value={value} onChange={(e) => onChange(Number(e.target.value))} />{hint && <span className="text-xs text-slate-500">{hint}</span>}</label>;
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
  if (loading || !s) return <><PageHeader title="System Settings" /><ErrorBox error={error} />{!error && <Spinner />}</>;
  return (
    <>
      <PageHeader title="System Settings" description="Thresholds, AI engine and alert rules. Changes apply to new analyses and are recorded in the audit log." />
      <ErrorBox error={err} />
      <div className="mt-3 grid gap-5 lg:grid-cols-2">
        <Card title="Sentiment classification thresholds" subtitle="Score ranges from −100 to +100" action={<SaveBtn k="sentiment_thresholds" />}>
          <div className="grid grid-cols-2 gap-3">
            <Num label="Negative when score ≤" value={s.sentiment_thresholds.negative_max} onChange={(n) => put("sentiment_thresholds", { negative_max: n })} />
            <Num label="Positive when score ≥" value={s.sentiment_thresholds.positive_min} onChange={(n) => put("sentiment_thresholds", { positive_min: n })} />
          </div>
          <p className="mt-2 text-xs text-slate-500">Scores in between are neutral. Default: −25 / +25. Use “Re-run analysis” on a feedback item to apply new thresholds to older items.</p>
        </Card>
        <Card title="Confidence-based review" subtitle="Confidence is not a guarantee of correctness" action={<SaveBtn k="confidence_thresholds" />}>
          <div className="grid grid-cols-2 gap-3">
            <Num label="High confidence from" step={0.01} value={s.confidence_thresholds.high} onChange={(n) => put("confidence_thresholds", { high: n })} hint="e.g. 0.90" />
            <Num label="Manual review below" step={0.01} value={s.confidence_thresholds.moderate} onChange={(n) => put("confidence_thresholds", { moderate: n })} hint="e.g. 0.70" />
          </div>
        </Card>
        <Card title="AI analysis engine" action={<SaveBtn k="ai_provider" />}>
          <div className="space-y-3 text-sm">
            <label className="flex items-start gap-2"><input type="radio" checked={s.ai_provider.provider === "rule"} onChange={() => put("ai_provider", { provider: "rule" })} className="mt-1" />
              <span><b>Built-in engine (free)</b><span className="block text-xs text-slate-500">Context-aware English/Filipino/Taglish rules: negation, contrast (“pero”), sarcasm cues, emotion, intent, topic and priority. No API cost.</span></span></label>
            <label className="flex items-start gap-2"><input type="radio" checked={s.ai_provider.provider === "claude"} onChange={() => put("ai_provider", { provider: "claude" })} className="mt-1" disabled={!s.ai_provider.api_key_set} />
              <span><b>Claude (Anthropic)</b> {s.ai_provider.api_key_set ? <Tag tone="green">API key configured</Tag> : <Tag>No API key</Tag>}
                <span className="block text-xs text-slate-500">Deeper context and sarcasm understanding using a large language model, with automatic fallback to the built-in engine. Requires ANTHROPIC_API_KEY on the server; usage is billed by Anthropic per request.{IS_DEMO && " Not available in the browser demo."}</span></span></label>
            <label className="block w-72"><span className="label">Claude model</span><input className="input" value={s.ai_provider.claude_model} onChange={(e) => put("ai_provider", { claude_model: e.target.value })} /></label>
          </div>
        </Card>
        <Card title="Notifications & alerts" action={<SaveBtn k="alerts" />}>
          <div className="grid grid-cols-3 gap-3">
            <Num label="Negative spike (%)" value={s.alerts.negative_spike_pct} onChange={(n) => put("alerts", { negative_spike_pct: n })} hint="Relative rise vs. previous week" />
            <Num label="Repeated complaints" value={s.alerts.repeated_complaint_count} onChange={(n) => put("alerts", { repeated_complaint_count: n })} hint="Same topic in 7 days" />
            <Num label="Unresolved after (days)" value={s.alerts.unresolved_days} onChange={(n) => put("alerts", { unresolved_days: n })} />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={s.alerts.email_enabled} onChange={(e) => put("alerts", { email_enabled: e.target.checked })} />Also email critical and high alerts to Admins (requires SMTP settings on the server)</label>
        </Card>
        <Card title="Data retention" action={<SaveBtn k="retention" />}>
          <div className="grid grid-cols-2 gap-3">
            <Num label="Keep feedback (days)" value={s.retention.feedback_days} onChange={(n) => put("retention", { feedback_days: n })} />
            <Num label="Keep audit logs (days)" value={s.retention.audit_days} onChange={(n) => put("retention", { audit_days: n })} />
          </div>
          <p className="mt-2 text-xs text-slate-500">A daily job deletes records older than these limits.</p>
        </Card>
      </div>
    </>
  );
}
