import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Settings, WatchResult } from "../api/types";
import { ValueBars } from "../components/charts";
import { Card, Empty, ErrorBox, PageHeader, Spinner, Tag } from "../components/ui";
import { fmtDate } from "../lib/format";

const MOOD = { positive: ["green", "Happy"], neutral: ["slate", "Neutral"], negative: ["red", "Unhappy"] } as const;

/** The owner picks words; every customer message that contains one is flagged here and in the Inbox. */
export default function KeywordWatch() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<WatchResult | null>(null);
  const [s, setS] = useState<Settings | null>(null);
  const [word, setWord] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const load = () => api.keywordWatch(days).then(setData).catch(setErr);
  useEffect(() => { setData(null); load(); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.settings().then(setS).catch(setErr); }, []);
  const saveWords = async (words: string[]) => { setErr(null); try { setS(await api.saveSettings({ ...s!, watch_words: words })); load(); } catch (x) { setErr(x); } };
  return (
    <>
      <PageHeader eyebrow="Keyword watch" title="Words you want to hear about first" description="Every comment, chat, request or review with one of these words is flagged, in English, Tagalog or Taglish. “cancel” also catches “cancelled”." />
      <ErrorBox error={err} />
      {s && (
        <Card title="Watched words" className="mb-6">
          <div className="flex flex-wrap gap-2">
            {s.watch_words.map((w) => <span key={w} className="inline-flex items-center gap-1 rounded-full border border-gold-300 bg-gold-50 py-1 pl-3 pr-1 text-sm text-gold-700">{w}<button aria-label={`Stop watching ${w}`} className="rounded-full p-0.5 hover:bg-gold-100" onClick={() => saveWords(s.watch_words.filter((x) => x !== w))}><X className="h-3.5 w-3.5" /></button></span>)}
          </div>
          <form className="mt-3 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); if (word.trim()) { saveWords([...s.watch_words, word.trim()]); setWord(""); } }}>
            <input className="input" placeholder="Add a word, e.g. refund" maxLength={40} value={word} onChange={(e) => setWord(e.target.value)} aria-label="New watch word" />
            <button className="btn-primary shrink-0">Add</button>
          </form>
        </Card>
      )}
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-full border border-ivory-300 bg-white p-1 sm:inline-flex">
        {[7, 30, 90].map((d) => <button key={d} onClick={() => setDays(d)} className={clsx("shrink-0 rounded-full px-4 py-2 text-sm", days === d ? "bg-ink-900 text-ivory-50" : "text-ink-500")}>Last {d} days</button>)}
      </div>
      {!data ? <Spinner /> : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
          <Card title={`${data.total} flagged message${data.total === 1 ? "" : "s"}`}>
            {data.counts.some((c) => c.count) ? <ValueBars items={data.counts.filter((c) => c.count).sort((a, b) => b.count - a.count).map((c) => ({ label: c.word, value: c.count }))} /> : <p className="text-sm text-ink-400">No watched words in this period.</p>}
          </Card>
          <Card title="Messages">
            {data.items.length ? <ul className="space-y-3">{data.items.slice(0, 60).map((i, k) => (
              <li key={k} className="rounded-xl border border-ivory-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">{i.hits.map((h) => <Tag key={h} tone="gold">{h}</Tag>)}<Tag tone={MOOD[i.mood as keyof typeof MOOD][0]}>{MOOD[i.mood as keyof typeof MOOD][1]}</Tag><span>{i.where} · {i.client} · {fmtDate(i.at)}</span>
                  {i.request_id && <Link className="text-gold-700 hover:underline" to={`/staff/requests/${i.request_id}`}>{i.ref ?? "Request"}</Link>}</div>
                <p className="mt-1 text-sm text-ink-800">“{i.text}”</p>
              </li>))}</ul> : <Empty title="Nothing flagged" />}
          </Card>
        </div>
      )}
    </>
  );
}
