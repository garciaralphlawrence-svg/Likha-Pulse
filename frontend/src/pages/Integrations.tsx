import { CheckCircle2, Facebook, MessageCircle, PenLine, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import { Card, ErrorBox, PageHeader, Spinner } from "../components/ui";
import { useAuth } from "../lib/auth";
import { ago } from "../lib/format";
import { useAsync } from "../lib/useAsync";

const META: Record<string, { name: string; what: string; icon: JSX.Element; bg: string }> = {
  google_business: { name: "Google Reviews", what: "Reviews and star ratings from your Google Business Profile.", icon: <span className="font-display text-xl font-bold">G</span>, bg: "bg-white text-ink-900 ring-1 ring-ivory-300" },
  facebook_page: { name: "Facebook Comments", what: "Comments on your Facebook Page posts.", icon: <Facebook className="h-5 w-5" />, bg: "bg-ink-900 text-gold-300" },
  messenger: { name: "Messenger Chats", what: "Messages customers send to your Facebook Page.", icon: <MessageCircle className="h-5 w-5" />, bg: "bg-gold-500 text-white" },
  manual: { name: "Added by staff", what: "Feedback your team types in from calls, walk-ins or email.", icon: <PenLine className="h-5 w-5" />, bg: "bg-ivory-200 text-ink-700" },
};

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
      <PageHeader eyebrow="Connections" title="Where your messages come from" description="Once connected, new reviews, comments and chats arrive here automatically and the AI reads each one." />
      <ErrorBox error={error || err} />
      {msg && <div className="mb-4 rounded-2xl border border-ivory-300 bg-white px-4 py-3 text-sm text-ink-700">{msg}</div>}
      {loading && !data ? <Spinner /> : (
        <div className="grid gap-5 md:grid-cols-2">
          {data?.map((i) => {
            const m = META[i.code] ?? META.manual;
            const connected = i.status === "connected";
            return (
              <div key={i.code} className="card flex flex-col p-6">
                <div className="flex items-start gap-4">
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${m.bg}`}>{m.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-display text-2xl font-semibold">{m.name}</h2>
                      {connected
                        ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5" />Connected</span>
                        : <span className="rounded-full bg-ivory-100 px-3 py-1 text-xs font-medium text-ink-500">{i.status === "error" ? "Needs attention" : "Not connected yet"}</span>}
                    </div>
                    <p className="mt-1 text-sm text-ink-500">{m.what}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-1 items-end justify-between gap-3 border-t border-ivory-200 pt-4 text-sm">
                  <span className="text-ink-400">{i.feedback_count} messages{i.last_sync_at ? ` · updated ${ago(i.last_sync_at)}` : ""}</span>
                  {i.code !== "manual" && (connected
                    ? can("integrations.manage") && <button className="btn-secondary" disabled={busy === i.code} onClick={() => run(i.code, () => api.sync(i.code), (r) => `${m.name}: ${r.added ?? 0} new message(s).`)}><RefreshCw className={`h-4 w-4 ${busy === i.code ? "animate-spin" : ""}`} />Check for new</button>
                    : <span className="text-xs text-gold-700">Likha Studio will connect this for you</span>)}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {can("integrations.manage") && (
        <Card title="Sample messages" className="mt-6" subtitle="Used to preview the system before your accounts are connected. Sample messages are always marked “Sample”.">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-sm text-ink-500">{samples} sample messages.</span>
            <button className="btn-secondary" disabled={!!busy} onClick={() => run("load", () => api.loadSample(), (r) => `Added ${r.added} sample messages.`)}>Add sample messages</button>
            <button className="btn-danger" disabled={!!busy || !samples} onClick={() => confirm("Remove all sample messages? Real messages stay.") && run("clear", () => api.clearSample(), (r) => `Removed ${r.deleted} sample messages.`)}><Trash2 className="h-4 w-4" />Remove samples</button>
          </div>
        </Card>
      )}
    </>
  );
}
