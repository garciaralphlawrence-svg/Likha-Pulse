// Ready replies for one message, in English and Taglish. Copy only: the team sends it themselves in Messenger or on Facebook.
import clsx from "clsx";
import { Check, Copy, MessageSquareQuote } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAsync } from "../lib/useAsync";
import { Spinner } from "./ui";

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* older browsers or blocked clipboard */ }
  try {
    const t = document.createElement("textarea"); t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); return ok;
  } catch { return false; }
}

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <button type="button" className={clsx("btn-secondary px-3 py-1.5 text-xs", className)}
      onClick={async () => { const ok = await copyText(text); setState(ok ? "ok" : "fail"); setTimeout(() => setState("idle"), 1800); }}>
      {state === "ok" ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5" />}
      {state === "ok" ? "Copied" : state === "fail" ? "Select and copy" : label}
    </button>
  );
}

export default function SuggestedReplies({ id }: { id: string }) {
  const { data, error } = useAsync(() => api.suggestions(id), [id]);
  const [lang, setLang] = useState<"tl" | "en">("tl");
  if (error) return null;
  if (!data) return <Spinner label="Finding a good reply…" />;
  const list = data.templates.filter((t) => t.language === lang);
  const shown = list.length ? list : data.templates;
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><MessageSquareQuote className="h-3.5 w-3.5" />Suggested reply</p>
          <p className="font-display text-xl font-semibold text-ink-900">{data.situation_label}</p>
        </div>
        <div className="flex rounded-full border border-ivory-300 bg-white p-0.5 text-xs" role="tablist" aria-label="Reply language">
          {(["tl", "en"] as const).map((l) => (
            <button key={l} role="tab" aria-selected={lang === l} onClick={() => setLang(l)}
              className={clsx("rounded-full px-3 py-1 transition", lang === l ? "bg-ink-900 text-ivory-50" : "text-ink-500 hover:text-ink-900")}>{l === "tl" ? "Taglish" : "English"}</button>
          ))}
        </div>
      </div>
      <ul className="mt-3 space-y-3">
        {shown.map((t) => (
          <li key={t.id} className="rounded-2xl bg-ivory-50 p-4 ring-1 ring-ivory-200">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-ink-800">{t.title}</p>
              <CopyButton text={t.body} />
            </div>
            <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-ink-700">{t.body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-400">Copy it, then paste it in Messenger or on Facebook. Nothing is sent automatically. <Link to="/replies" className="text-gold-700 hover:underline">Edit replies</Link></p>
    </section>
  );
}
