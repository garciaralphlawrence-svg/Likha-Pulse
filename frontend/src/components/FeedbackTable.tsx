import { ChevronLeft, ChevronRight } from "lucide-react";
import type { FeedbackItem, Paged } from "../api/types";
import { PLATFORM_LABEL, fmtDate, pretty } from "../lib/format";
import { ConfidenceBar, Empty, PriorityBadge, SampleTag, SentimentBadge, Tag } from "./ui";

export default function FeedbackTable({ data, page, pageSize, onPage, onOpen }: { data: Paged<FeedbackItem>; page: number; pageSize: number; onPage: (p: number) => void; onOpen: (id: string) => void }) {
  const pages = Math.max(1, Math.ceil(data.total / pageSize));
  if (!data.items.length) return <Empty title="No feedback matches these filters" />;
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-[1200px] w-full border-collapse">
          <thead><tr>{["ID", "Platform", "Author", "Comment / message", "Date", "Sentiment", "Confidence", "Emotion", "Intent", "Topic", "Priority", "Review"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>
            {data.items.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpen(r.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(r.id)}>
                <td className="td font-mono text-xs text-slate-500">{r.id.slice(0, 8)}</td>
                <td className="td whitespace-nowrap">{PLATFORM_LABEL[r.platform] ?? r.platform_name}</td>
                <td className="td whitespace-nowrap text-xs text-slate-500">{r.author}</td>
                <td className="td max-w-[380px]"><p className="line-clamp-2">{r.content}</p><div className="mt-1 flex gap-1">{r.is_sample && <SampleTag />}{r.possible_sarcasm && <Tag tone="amber">Sarcasm?</Tag>}</div></td>
                <td className="td whitespace-nowrap text-xs text-slate-500">{fmtDate(r.created_at)}</td>
                <td className="td whitespace-nowrap"><SentimentBadge value={r.sentiment} score={r.score} /></td>
                <td className="td"><ConfidenceBar value={r.confidence} /></td>
                <td className="td whitespace-nowrap">{pretty(r.emotion)}</td>
                <td className="td whitespace-nowrap">{pretty(r.intent)}</td>
                <td className="td whitespace-nowrap">{r.topic}</td>
                <td className="td"><PriorityBadge value={r.priority} /></td>
                <td className="td whitespace-nowrap"><Tag tone={r.review_status === "reviewed" ? "green" : r.review_status === "pending_review" ? "amber" : "slate"}>{pretty(r.review_status)}</Tag></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 text-sm text-slate-600">
        <span>{data.total.toLocaleString()} results · page {page} of {pages}</span>
        <div className="flex gap-1">
          <button className="btn-secondary px-2" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
          <button className="btn-secondary px-2" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
