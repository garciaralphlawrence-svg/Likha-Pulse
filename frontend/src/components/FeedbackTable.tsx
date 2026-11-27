// Inbox list: each comment / review / chat as a message card with the AI's one-line review.
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Eye, Facebook, FileUp, MessageCircle, PenLine, Star } from "lucide-react";
import type { FeedbackItem, Paged } from "../api/types";
import { PLATFORM_LABEL, SENT_COLORS, ago, headline } from "../lib/format";
import { Empty, PriorityBadge, SampleTag, Tag } from "./ui";

function SourceIcon({ p }: { p: string }) {
  const map: Record<string, [JSX.Element, string]> = {
    facebook_page: [<Facebook className="h-4 w-4" />, "bg-ink-900 text-gold-300"],
    messenger: [<MessageCircle className="h-4 w-4" />, "bg-gold-500 text-white"],
    manual: [<PenLine className="h-4 w-4" />, "bg-ivory-200 text-ink-700"],
    import: [<FileUp className="h-4 w-4" />, "bg-ivory-100 text-gold-700 ring-1 ring-ivory-300"],
  };
  const [icon, cls] = map[p] ?? map.manual;
  return <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-full", cls)}>{icon}</span>;
}

export function SourceBadge({ p }: { p: string }) { return <SourceIcon p={p} />; }

export default function FeedbackTable({ data, page, pageSize, onPage, onOpen, hideClient = false }: { data: Paged<FeedbackItem>; page: number; pageSize: number; onPage: (p: number) => void; onOpen: (id: string) => void; hideClient?: boolean }) {
  const pages = Math.max(1, Math.ceil(data.total / pageSize));
  if (!data.items.length) return <Empty title="No messages here">Try a different time period or filter.</Empty>;
  return (
    <div>
      <ul className="stagger space-y-3">
        {data.items.map((r) => (
          <li key={r.id}>
            <button onClick={() => onOpen(r.id)} className="card group flex w-full gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-gold-300 hover:shadow-lift">
              <SourceIcon p={r.platform} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-400">
                  {!hideClient && <><span className="font-medium text-ink-800">{r.client}</span><span>·</span></>}
                  <span className="font-medium text-ink-700">{PLATFORM_LABEL[r.platform] ?? r.platform_name}</span>
                  <span>·</span><span>{ago(r.created_at)}</span>
                  {r.rating && <span className="flex items-center gap-0.5 text-gold-500">{Array.from({ length: Math.round(r.rating) }, (_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}</span>}
                  {r.is_sample && <SampleTag />}
                  {r.is_imported ? <Tag>Imported</Tag> : r.action_status === "resolved" && <Tag tone="green">Done</Tag>}
                </div>
                <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-ink-900">“{r.content}”</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-ivory-100 px-3 py-1 text-[13px] text-ink-700">
                    <span className="h-2 w-2 rounded-full" style={{ background: SENT_COLORS[r.sentiment] }} />
                    <span className="font-medium text-gold-700">AI:</span> {headline(r)}
                  </span>
                  {r.possible_sarcasm && <Tag tone="gold">Might be sarcastic</Tag>}
                  {r.review_status === "pending_review" && <Tag tone="gold">Please double-check</Tag>}
                  {r.watch_hits?.length > 0 && <Tag tone="red"><Eye className="mr-1 h-3 w-3" />{r.watch_hits.join(", ")}</Tag>}
                </div>
              </div>
              <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex"><PriorityBadge value={r.priority} /></div>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-center justify-between text-sm text-ink-500">
        <span>{data.total.toLocaleString()} messages · page {page} of {pages}</span>
        <div className="flex gap-2">
          <button className="btn-secondary px-3" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
          <button className="btn-secondary px-3" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
