import clsx from "clsx";
import { Check, HelpCircle, MessageSquare, PencilLine, Search, ThumbsUp } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { IS_DEMO, api } from "../api";
import type { PublicView } from "../api/types";
import Quotation from "../components/Quotation";
import RecommendationView from "../components/Recommendation";
import { ErrorBox, Modal, Spinner } from "../components/ui";
import { fmtDate } from "../lib/format";
import { ActionCode } from "../quote/workflow";

const MINE = "paph.my.requests";
export function rememberRequest(ref: string, contact: string) {
  try { const list: { ref: string; contact: string }[] = JSON.parse(localStorage.getItem(MINE) ?? "[]"); localStorage.setItem(MINE, JSON.stringify([{ ref, contact }, ...list.filter((x) => x.ref !== ref)].slice(0, 6))); } catch { /* ignore */ }
}
const mine = (): { ref: string; contact: string }[] => { try { return JSON.parse(localStorage.getItem(MINE) ?? "[]"); } catch { return []; } };
const STEPS = ["Received", "Being prepared", "Offer ready", "Accepted", "Booked"];

function Lookup() {
  const nav = useNavigate();
  const [ref, setRef] = useState("");
  const [contact, setContact] = useState("");
  const year = new Date(Date.now() - 40 * 3600000).getFullYear();
  const go = (e: FormEvent) => { e.preventDefault(); nav(`/track/${ref.trim().toUpperCase()}?c=${encodeURIComponent(contact.trim())}`); };
  const recent = mine();
  return (
    <div className="mx-auto max-w-[560px] px-4 py-12 sm:px-6 sm:py-16">
      <p className="eyebrow">Track my request</p>
      <h1 className="mt-1 font-display text-4xl font-semibold">Where is my offer?</h1>
      <p className="mt-2 text-sm text-ink-500">Enter your reference number and the mobile number or email you used.</p>
      <form onSubmit={go} className="card mt-6 space-y-3 p-5 sm:p-6">
        <label className="block"><span className="label">Reference number</span><input className="input uppercase" required placeholder={`PAPH-${year}-0001`} value={ref} onChange={(e) => setRef(e.target.value)} /></label>
        <label className="block"><span className="label">Mobile number or email</span><input className="input" required value={contact} onChange={(e) => setContact(e.target.value)} /></label>
        <button className="btn-primary w-full py-3"><Search className="h-4 w-4" />Find my request</button>
      </form>
      {recent.length > 0 && (
        <div className="mt-6"><p className="label">Sent from this device</p>
          <div className="flex flex-wrap gap-2">{recent.map((r) => <Link key={r.ref} className="btn-secondary" to={`/track/${r.ref}?c=${encodeURIComponent(r.contact)}`}>{r.ref}</Link>)}</div>
        </div>
      )}
      {IS_DEMO && (
        <div className="mt-6 rounded-2xl border border-gold-300/60 bg-gold-50 p-4 text-sm text-ink-700">
          <p className="font-medium text-gold-700">Try a sample request</p>
          <p className="mt-1 text-xs">Reference <b>PAPH-{year}-0007</b> with mobile <b>0920 555 0106</b> (an offer that is ready), or <b>PAPH-{year}-0012</b> with <b>0926 555 0112</b> (an expired offer).</p>
          <Link className="mt-2 inline-block text-xs font-semibold underline" to={`/track/PAPH-${year}-0007?c=${encodeURIComponent("0920 555 0106")}`}>Open the sample</Link>
        </div>
      )}
    </div>
  );
}

export default function Track() {
  const { ref } = useParams();
  const [sp] = useSearchParams();
  const contact = sp.get("c") ?? "";
  const [v, setV] = useState<PublicView | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [ask, setAsk] = useState<null | ActionCode>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!ref) return;
    setV(null); setErr(null);
    api.track(ref, contact).then(setV).catch(setErr);
  }, [ref, contact]);
  if (!ref) return <Lookup />;
  if (err) return <div className="mx-auto max-w-[560px] px-4 py-16"><ErrorBox error={err} /><Link className="btn-secondary" to="/track">Try again</Link></div>;
  if (!v) return <div className="mx-auto max-w-[560px] px-4 py-16"><Spinner /></div>;

  const act = async (action: ActionCode, n = "") => {
    setBusy(true); setErr(null);
    try { setV(await api.customerAction(v.ref, contact, action, n)); setAsk(null); setNote(""); } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  const closed = v.step < 0;
  const step = v.status === "booked" ? 4 : v.step;
  return (
    <div className="mx-auto max-w-[980px] px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Request {v.ref}</p>
          <h1 className="mt-1 font-display text-4xl font-semibold leading-tight">{v.customer_status}</h1>
          <p className="mt-1 text-sm text-ink-500">Hi {v.customer_name.replace(/^Sample: /, "")}! Sent {fmtDate(v.created_at)}.</p>
        </div>
      </div>

      {!closed && (
        <ol className="mt-6 grid grid-cols-5 gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s} className="min-w-0">
              <div className={clsx("h-1.5 rounded-full transition-all duration-700", i <= step ? "bg-gold-500" : "bg-ivory-300")} />
              <p className={clsx("mt-2 text-[10px] leading-tight sm:text-xs", i <= step ? "font-medium text-ink-900" : "text-ink-400")}>{s}</p>
            </li>
          ))}
        </ol>
      )}

      <ErrorBox error={err} />
      {v.question && <div className="mt-6 flex gap-3 rounded-2xl border border-ivory-300 bg-white p-4 text-sm"><HelpCircle className="h-5 w-5 shrink-0 text-gold-600" /><span><b>Your question:</b> {v.question.text}<span className="block text-xs text-ink-400">Your travel consultant will answer soon.</span></span></div>}

      {v.offer && v.terms ? (
        <div className="mt-8 space-y-4">
          {v.can.length > 0 && (
            <div className="card flex flex-wrap items-center justify-between gap-3 p-4 print:hidden">
              <p className="text-sm text-ink-600">{v.expired ? "This offer has expired. Ask us to recheck the rates." : "Happy with your offer? Accept it, or tell us what to change."}</p>
              <div className="flex flex-wrap gap-2">
                {v.can.includes("customer_accept") && <button className="btn-gold" disabled={busy} onClick={() => act("customer_accept")}><ThumbsUp className="h-4 w-4" />Accept offer</button>}
                {v.can.includes("customer_changes") && <button className="btn-secondary" onClick={() => setAsk("customer_changes")}><PencilLine className="h-4 w-4" />Request changes</button>}
                {v.can.includes("customer_question") && <button className="btn-secondary" onClick={() => setAsk("customer_question")}><MessageSquare className="h-4 w-4" />Ask a question</button>}
              </div>
            </div>
          )}
          {v.status === "accepted" && <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><Check className="h-5 w-5 shrink-0" />You accepted this offer. Your travel consultant will send deposit instructions to confirm your booking.</div>}
          <Quotation q={{ customer: v.customer_name, input: v.input, rec: v.recommendation, option: v.offer.option, lines: v.offer.lines, discount: v.offer.discount, total: v.offer.total, per_person: v.offer.per_person, notes: v.offer.notes, terms: v.terms }} />
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {!closed && (
            <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-sm text-ink-600">A PAPH travel consultant is working on your official offer. Below is your AI estimate in the meantime.</p>
              {v.can.includes("customer_question") && <button className="btn-secondary" onClick={() => setAsk("customer_question")}><MessageSquare className="h-4 w-4" />Ask a question</button>}
            </div>
          )}
          {closed ? <div className="card p-6 text-sm text-ink-600">This request is closed. You can send a new request anytime from <Link className="underline" to="/">Plan a trip</Link>.</div> : <RecommendationView rec={v.recommendation} addons={v.addons} />}
        </div>
      )}

      <section className="mt-10 print:hidden">
        <p className="label">History</p>
        <ol className="space-y-2 border-l border-ivory-300 pl-4">
          {[...v.timeline].reverse().map((e, i) => <li key={i} className="text-sm"><span className="text-ink-800">{e.label}</span><span className="block text-xs text-ink-400">{fmtDate(e.at)}</span></li>)}
        </ol>
      </section>

      <Modal open={!!ask} onClose={() => setAsk(null)} title={ask === "customer_changes" ? "What should we change?" : "Ask your travel consultant"}>
        <textarea className="input min-h-[120px]" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={ask === "customer_changes" ? "e.g. Cheaper hotel, or move it to January" : "e.g. Kasama na po ba ang breakfast?"} />
        <div className="mt-4 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setAsk(null)}>Cancel</button><button className="btn-primary" disabled={!note.trim() || busy} onClick={() => act(ask!, note)}>Send</button></div>
      </Modal>
    </div>
  );
}
