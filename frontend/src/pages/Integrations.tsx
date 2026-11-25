import { CheckCircle2, CircleSlash, ExternalLink, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import { Card, ErrorBox, PageHeader, SampleTag, Spinner } from "../components/ui";
import { useAuth } from "../lib/auth";
import { fmtDate } from "../lib/format";
import { useAsync } from "../lib/useAsync";

const STATUS = {
  connected: { icon: CheckCircle2, cls: "text-emerald-700 bg-emerald-50", label: "Connected" },
  not_connected: { icon: CircleSlash, cls: "text-slate-600 bg-slate-100", label: "Not connected" },
  error: { icon: TriangleAlert, cls: "text-red-700 bg-red-50", label: "Error" },
} as const;

export default function Integrations() {
  const { can } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.integrations(), []);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const run = async (key: string, fn: () => Promise<any>, ok: (r: any) => string) => {
    setBusy(key); setErr(null); setMsg(null);
    try { const r = await fn(); setMsg(ok(r)); reload(); } catch (e) { setErr(e); } finally { setBusy(null); }
  };
  const samples = data?.reduce((s, i) => s + i.sample_count, 0) ?? 0;
  return (
    <>
      <PageHeader title="Platform Integrations" description="Each platform is a separate module using official APIs and authorized accounts only. A platform shows as connected only after real credentials are configured on the server and a sync succeeds." />
      <ErrorBox error={error || err} />
      {msg && <div className="mb-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{msg}</div>}
      {loading && !data ? <Spinner /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {data?.map((i) => {
            const st = STATUS[(i.status as keyof typeof STATUS)] ?? STATUS.not_connected;
            return (
              <Card key={i.code} title={i.name} action={<span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${st.cls}`}><st.icon className="h-3.5 w-3.5" />{st.label}</span>}>
                <p className="text-sm text-slate-600">{i.detail}</p>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                  <span>{i.feedback_count} item(s) collected</span>{i.sample_count > 0 && <span className="flex items-center gap-1"><SampleTag />{i.sample_count}</span>}
                  <span>Last sync: {fmtDate(i.last_sync_at)}</span>
                </div>
                {i.missing.length > 0 && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs">
                    <p className="font-medium text-slate-700">Server environment variables needed:</p>
                    <ul className="mt-1 space-y-0.5 font-mono text-slate-600">{i.missing.map((m) => <li key={m}>{m}</li>)}</ul>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {i.code !== "manual" && can("integrations.manage") && <button className="btn-secondary" disabled={busy === i.code} onClick={() => run(i.code, () => api.sync(i.code), (r) => `${i.name}: ${r.status === "connected" ? `fetched ${r.fetched}, added ${r.added} new` : r.detail}`)}><RefreshCw className={`h-4 w-4 ${busy === i.code ? "animate-spin" : ""}`} />Sync now</button>}
                  {i.docs_url && <a className="btn-ghost" href={i.docs_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />API documentation</a>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {can("integrations.manage") && (
        <Card title="Sample data" className="mt-5" subtitle="For demonstrations before a platform is connected. Sample items are always labeled and can be removed at any time.">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-600">{samples} sample item(s) stored.</span>
            <button className="btn-secondary" disabled={!!busy} onClick={() => run("load", () => api.loadSample(), (r) => `Added ${r.added} sample item(s).`)}>Load sample data</button>
            <button className="btn-danger" disabled={!!busy || !samples} onClick={() => confirm("Delete all sample feedback? Real feedback is not affected.") && run("clear", () => api.clearSample(), (r) => `Deleted ${r.deleted} sample item(s).`)}><Trash2 className="h-4 w-4" />Delete sample data</button>
          </div>
        </Card>
      )}
    </>
  );
}
