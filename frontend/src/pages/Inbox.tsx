import clsx from "clsx";
import { Facebook, FileUp, MessageCircle, Siren, Ticket } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import type { MessageView } from "../api/types";
import { ClockChip, SuggestedReplies, useNow } from "../components/clock";
import { Empty, ErrorBox, PageHeader, SampleTag, Spinner, Tag } from "../components/ui";
import { ago } from "../lib/format";

const ICON = { facebook_page: Facebook, messenger: MessageCircle, import: FileUp } as const;
const MOOD = { positive: ["green", "Happy"], neutral: ["slate", "Neutral"], negative: ["red", "Unhappy"] } as const;

export default function Inbox() {
  const nav = useNavigate();
  const now = useNow();
  const [view, setView] = useState<"waiting" | "all">("waiting");
  const [items, setItems] = useState<MessageView[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = () => api.messages(view).then(setItems).catch(setErr);
  useEffect(() => { setItems(null); load(); }, [view]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (m: MessageView, action: "reply" | "open_case" | "make_request") => {
    setErr(null);
    try {
      const r = await api.messageAction(m.id, action);
      if (action === "open_case" && r.case_id) return nav(`/staff/clock?open=${r.case_id}`);
      if (action === "make_request" && r.request_id) return nav(`/staff/requests/${r.request_id}`);
      setOpen(null); load();
    } catch (x) { setErr(x); }
  };
  return (
    <>
      <PageHeader eyebrow="Inbox" title="Facebook and Messenger" description="Customer comments and chats, read by AI. Unanswered ones run on the reply clock. Reply in Messenger or Facebook, then tap “I replied”." />
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-full border border-ivory-300 bg-white p-1 sm:inline-flex">
        {(["waiting", "all"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={clsx("shrink-0 rounded-full px-4 py-2 text-sm", view === v ? "bg-ink-900 text-ivory-50" : "text-ink-500")}>{v === "waiting" ? "Waiting for a reply" : "All messages"}</button>)}
      </div>
      <ErrorBox error={err} />
      {!items ? <Spinner /> : !items.length ? <Empty title="No messages waiting">Every customer has a reply.</Empty> : (
        <ul className="stagger space-y-3">
          {items.map((m) => {
            const Icon = ICON[m.channel];
            return (
              <li key={m.id} className="rounded-2xl border border-ivory-200 bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Icon className="h-4 w-4 text-ink-400" />
                  <span className="text-xs text-ink-500">{m.channel_label}</span>
                  <Tag tone={MOOD[m.mood][0]}>{MOOD[m.mood][1]}</Tag>
                  {m.watch_hits.map((w) => <Tag key={w} tone="gold">Watch: {w}</Tag>)}
                  {m.is_sample && <SampleTag />}
                  <span className="ml-auto text-xs text-ink-400">{ago(m.at)}</span>
                </div>
                <p className="mt-2 font-display text-lg leading-snug text-ink-900">“{m.text}”</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                  <Link className="font-medium text-gold-700 hover:underline" to={`/staff/clients/${encodeURIComponent(m.client_key)}`}>{m.client}</Link>
                  {m.theme !== "General" && <span>About {m.theme_label.toLowerCase()}</span>}
                  {m.clock ? <ClockChip clock={m.clock} now={now} /> : m.first_reply_at && <span>Replied by {m.handled_by?.name ?? "the team"}</span>}
                  {m.case_id && <Link className="text-gold-700 hover:underline" to={`/staff/clock?open=${m.case_id}`}>Case {m.case_id}</Link>}
                  {m.request_id && <Link className="text-gold-700 hover:underline" to={`/staff/requests/${m.request_id}`}>{m.request_ref ?? "Quotation request"}</Link>}
                </div>
                {!m.is_imported && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!m.first_reply_at && <button className="btn-primary py-1.5" onClick={() => setOpen(open === m.id ? null : m.id)}>Reply</button>}
                    {!m.case_id && <button className="btn-secondary py-1.5" onClick={() => act(m, "open_case")}><Siren className="h-4 w-4" />Open a case</button>}
                    {!m.request_id && <button className="btn-secondary py-1.5" onClick={() => act(m, "make_request")}><Ticket className="h-4 w-4" />Make a quote request</button>}
                  </div>
                )}
                {open === m.id && <div className="mt-3"><SuggestedReplies situation={m.reply_key} ctx={{ name: m.client.replace(/^Sample: /, "") }} onReplied={() => act(m, "reply")} /></div>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
