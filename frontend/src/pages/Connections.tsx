import { Facebook, FileUp, MessageCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Card, ErrorBox, PageHeader, Spinner, Tag } from "../components/ui";
import { useAuth } from "../lib/auth";
import { ago } from "../lib/format";
import { useAsync } from "../lib/useAsync";

const ICON: Record<string, JSX.Element> = { facebook_page: <Facebook className="h-5 w-5" />, messenger: <MessageCircle className="h-5 w-5" />, import: <FileUp className="h-5 w-5" /> };
const WHAT: Record<string, string> = {
  facebook_page: "Comments on PAPH's Facebook Page posts come into the Inbox, are read by the AI, and unhappy ones open a Response Clock case.",
  messenger: "Messages customers send to PAPH's Facebook Page come into the Inbox the same way. Any chat can become a quotation request with one tap.",
  import: "Old messages and surveys from Excel or CSV. They count in sentiment and reports as history, but never open cases.",
};

/** Facebook Page comments and Messenger through Meta's official API. Not connected until PAPH's Page is authorized. */
export default function Connections() {
  const { can } = useAuth();
  const { data, loading, error } = useAsync(() => api.integrations(), []);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const sync = async (code: string) => { try { const r = await api.syncIntegration(code); setMsg({ ...msg, [code]: r.detail }); } catch (x) { setMsg({ ...msg, [code]: x instanceof Error ? x.message : String(x) }); } };
  return (
    <>
      <PageHeader eyebrow="Connections" title="Where customer messages come from" description="Facebook comments and Messenger use Meta's official API only. Nothing is scraped, and nothing is sent to customers automatically." />
      <ErrorBox error={error} />
      {loading || !data ? <Spinner /> : (
        <div className="stagger grid gap-5 lg:grid-cols-3">
          {data.map((i) => (
            <Card key={i.code} title={<span className="flex items-center gap-2">{ICON[i.code]}{i.name}</span>}>
              <Tag tone={i.status === "connected" ? "green" : i.status === "error" ? "red" : "gold"}>{i.status === "connected" ? "Ready" : i.status === "error" ? "Problem" : "Not connected yet"}</Tag>
              <p className="mt-3 text-sm text-ink-600">{WHAT[i.code]}</p>
              <p className="mt-2 text-sm text-ink-500">{i.detail}</p>
              <p className="mt-3 text-xs text-ink-400">{i.message_count} messages{i.sample_count ? ` (${i.sample_count} sample)` : ""}{i.last_sync_at ? ` · last synced ${ago(i.last_sync_at)}` : ""}</p>
              {i.code !== "import" && i.status !== "connected" && (
                <div className="mt-3 rounded-xl bg-ivory-100 p-3 text-xs text-ink-600">
                  <p className="font-medium text-ink-800">To connect</p>
                  <ol className="mt-1 list-decimal space-y-0.5 pl-4"><li>PAPH's Page admin creates a Meta app and passes Meta's app review.</li><li>Your developer puts the Page ID and Page access token on the server ({i.required_env.join(", ")}).</li><li>Messages then arrive every 30 minutes.</li></ol>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {i.code === "import" ? (can("import.manage") && <Link className="btn-secondary" to="/staff/import"><FileUp className="h-4 w-4" />Import a file</Link>)
                  : can("integrations.manage") && <button className="btn-secondary" onClick={() => sync(i.code)}><RefreshCw className="h-4 w-4" />Sync now</button>}
              </div>
              {msg[i.code] && <p className="mt-2 text-xs text-ink-500">{msg[i.code]}</p>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
