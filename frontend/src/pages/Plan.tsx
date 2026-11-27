import clsx from "clsx";
import { ArrowRight, CheckCircle2, Minus, Plus, Send, Wand2 } from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import RecommendationView from "../components/Recommendation";
import { ErrorBox } from "../components/ui";
import { MONTHS, Parsed, Tier, TIERS, catalog, parseRequest, recommend } from "../quote/engine";
import { rememberRequest } from "./Track";

const EXAMPLES = [
  "Gusto ko pumunta London 10 days, 5 star hotel",
  "Budget friendly London 10 days ₱80,000",
  "Budget friendly lang, Japan 5 days, 2 adults 1 kid, December",
  "Honeymoon in Bali, Dec 20-26, luxury villa, budget ₱250,000",
  "Boracay isang linggo, barkada kami 6 tao, mura lang",
];
const INTEREST_LABEL: Record<string, string> = {
  shopping: "Shopping", food: "Food trips", history: "History and culture", theme_parks: "Theme parks", nature: "Nature", beach: "Beaches",
  family: "Kid-friendly", romance: "Romantic", nightlife: "Nightlife", shows: "Shows", football: "Football", snow: "Snow",
};
const empty = (): Parsed => ({ destination: null, place_text: null, days: null, adults: null, kids: null, tier: null, budget: null, budget_per_person: false, month: null, travel_date: null, interests: [], understood: [] });
const today = () => new Date().toISOString().slice(0, 10);

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center rounded-xl border border-ivory-300 bg-white">
        <button type="button" className="grid h-10 w-10 place-items-center text-ink-500 hover:text-ink-900 disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label.toLowerCase()}`}><Minus className="h-4 w-4" /></button>
        <input className="w-full min-w-0 bg-transparent text-center text-sm font-medium focus:outline-none" inputMode="numeric" value={value} aria-label={label}
          onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ""), 10); onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min); }} />
        <button type="button" className="grid h-10 w-10 place-items-center text-ink-500 hover:text-ink-900 disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`More ${label.toLowerCase()}`}><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export default function Plan() {
  const [text, setText] = useState("");
  const [f, setF] = useState<Parsed | null>(null);
  const [addons, setAddons] = useState<string[]>([]);
  const [who, setWho] = useState({ name: "", contact: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [done, setDone] = useState<{ ref: string; contact: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const read = (t = text) => {
    if (!t.trim()) return;
    const p = parseRequest(t, today());
    setF(p); setAddons([]); setDone(null);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const set = (patch: Partial<Parsed>) => setF((x) => ({ ...(x ?? empty()), ...patch }));
  const rec = useMemo(() => (f ? recommend(f) : null), [f]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f) return;
    setBusy(true); setErr(null);
    try {
      const r = await api.submitRequest({ customer: who, raw_text: text, input: f, addons });
      rememberRequest(r.ref, r.contact);
      setDone(r);
    } catch (x) { setErr(x); } finally { setBusy(false); }
  };

  return (
    <>
      <section className="relative overflow-hidden bg-ink-950 pb-16 pt-10 text-ivory-50 sm:pb-24 sm:pt-16">
        <div className="glow-orb pointer-events-none absolute -left-40 top-10 h-[30rem] w-[30rem] rounded-full bg-gold-500/15 blur-3xl" />
        <div className="glow-orb pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gold-300/10 blur-3xl" style={{ animationDelay: "-3s" }} />
        <div className="relative mx-auto max-w-[880px] px-4 sm:px-6">
          <p className="eyebrow text-gold-300" style={{ animation: "fadeUp .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>AI travel quotation</p>
          <h1 className="mt-3 font-display text-[2.6rem] font-semibold leading-[1.02] sm:text-6xl" style={{ animation: "fadeUp .9s cubic-bezier(.2,.7,.2,1) .15s both" }}>Where would you like to go?</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ivory-200/75 sm:text-lg" style={{ animation: "fadeUp .9s cubic-bezier(.2,.7,.2,1) .3s both" }}>
            Type it the way you would say it, in English, Tagalog or Taglish. The AI gives you a price range and a suggested plan in seconds. A PAPH travel consultant then prepares your official offer.
          </p>
          <form className="mt-8" onSubmit={(e) => { e.preventDefault(); read(); }} style={{ animation: "fadeUp .9s cubic-bezier(.2,.7,.2,1) .45s both" }}>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-2 backdrop-blur">
              <textarea className="block min-h-[96px] w-full resize-none rounded-xl bg-transparent px-4 py-3 text-base text-ivory-50 placeholder:text-ivory-200/40 focus:outline-none" maxLength={600}
                placeholder="e.g. Gusto ko pumunta London 10 days, 5 star hotel" value={text} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); read(); } }} aria-label="Describe your trip" />
              <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1">
                <span className="text-xs text-ivory-200/50">Mention the place, days, travellers, hotel level, budget and month if you know them.</span>
                <button className="btn-gold px-5 py-2.5" disabled={!text.trim()}><Wand2 className="h-4 w-4" />Get my estimate</button>
              </div>
            </div>
          </form>
          <div className="mt-5 flex flex-wrap gap-2" style={{ animation: "fadeIn 1s ease .7s both" }}>
            {EXAMPLES.map((x) => (
              <button key={x} onClick={() => { setText(x); read(x); }} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-left text-xs text-ivory-200/80 transition hover:border-gold-300/50 hover:text-ivory-50">{x}</button>
            ))}
          </div>
        </div>
      </section>

      <div ref={resultRef} className="mx-auto max-w-[1180px] scroll-mt-4 px-4 sm:px-6">
        {f && rec && (
          <div className="-mt-8 space-y-6 pb-10 sm:-mt-12">
            <section className="card p-5 sm:p-6" style={{ animation: "fadeUp .6s cubic-bezier(.2,.7,.2,1) both" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Here is what we understood</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {f.understood.length ? f.understood.map((u) => <span key={u} className="rounded-full bg-ivory-100 px-3 py-1 text-xs text-ink-700">{u}</span>) : <span className="text-sm text-ink-400">Not much yet. Fill in the details below.</span>}
                  </div>
                </div>
                <p className="text-xs text-ink-400">Change anything below. The estimate updates right away.</p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                <label className="col-span-2 block">
                  <span className="label">Destination</span>
                  <select className="input" value={f.destination ?? (f.place_text ? "other" : "")} onChange={(e) => set(e.target.value === "other" ? { destination: null, place_text: f.place_text ?? "" } : { destination: e.target.value || null, place_text: null })}>
                    <option value="">Choose a destination</option>
                    {catalog.destinations.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
                    <option value="other">Somewhere else</option>
                  </select>
                </label>
                {!f.destination && f.place_text !== null ? (
                  <label className="col-span-2 block"><span className="label">Which place?</span><input className="input" value={f.place_text} maxLength={80} onChange={(e) => set({ place_text: e.target.value })} placeholder="e.g. Iceland" /></label>
                ) : (
                  <label className="col-span-2 block">
                    <span className="label">When</span>
                    <div className="grid grid-cols-2 gap-2">
                      <select className="input" value={f.month ?? ""} aria-label="Travel month" onChange={(e) => set({ month: e.target.value ? Number(e.target.value) : null, travel_date: null })}>
                        <option value="">Month not sure</option>
                        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                      </select>
                      <input className="input" type="date" aria-label="Departure date" min={today()} value={f.travel_date ?? ""} onChange={(e) => set({ travel_date: e.target.value || null, month: e.target.value ? Number(e.target.value.slice(5, 7)) : f.month })} />
                    </div>
                  </label>
                )}
                <Stepper label="Days" value={f.days ?? 5} min={2} max={30} onChange={(n) => set({ days: n })} />
                <Stepper label="Adults" value={f.adults ?? 1} min={1} max={20} onChange={(n) => set({ adults: n })} />
                <Stepper label="Kids (2–11)" value={f.kids ?? 0} min={0} max={10} onChange={(n) => set({ kids: n })} />
                <label className="block">
                  <span className="label">Budget (₱)</span>
                  <input className="input" inputMode="numeric" placeholder="Optional" value={f.budget ? f.budget.toLocaleString("en-PH") : ""} onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ""), 10); set({ budget: Number.isFinite(n) && n > 0 ? n : null }); }} />
                </label>
                <div className="col-span-2">
                  <span className="label">Hotel level</span>
                  <div className="grid grid-cols-4 gap-1 rounded-xl border border-ivory-300 bg-white p-1">
                    {([null, "budget", "mid", "luxury"] as (Tier | null)[]).map((t) => (
                      <button type="button" key={t ?? "any"} onClick={() => set({ tier: t })} className={clsx("rounded-lg px-1 py-2 text-xs font-medium transition sm:text-sm", f.tier === t ? "bg-ink-900 text-ivory-50" : "text-ink-500 hover:bg-ivory-100")}>{t ? TIERS[t].label : "Not sure"}</button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="label">Budget is</span>
                  <div className="grid grid-cols-2 gap-1 rounded-xl border border-ivory-300 bg-white p-1">
                    {[false, true].map((pp) => <button type="button" key={String(pp)} onClick={() => set({ budget_per_person: pp })} className={clsx("rounded-lg py-2 text-xs font-medium transition sm:text-sm", f.budget_per_person === pp ? "bg-ink-900 text-ivory-50" : "text-ink-500 hover:bg-ivory-100")}>{pp ? "Per person" : "For everyone"}</button>)}
                  </div>
                </div>
                <div className="col-span-2 md:col-span-4">
                  <span className="label">You enjoy</span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(INTEREST_LABEL).map((k) => {
                      const on = f.interests.includes(k);
                      return <button type="button" key={k} onClick={() => set({ interests: on ? f.interests.filter((x) => x !== k) : [...f.interests, k] })} className={clsx("rounded-full border px-3 py-1.5 text-xs transition", on ? "border-gold-500 bg-gold-50 text-gold-700" : "border-ivory-300 bg-white text-ink-500 hover:border-gold-300")}>{INTEREST_LABEL[k]}</button>;
                    })}
                  </div>
                </div>
              </div>
            </section>

            <RecommendationView key={`${rec.input.destination}-${rec.recommended}`} rec={rec} addons={addons} onToggleAddon={(c) => setAddons((a) => (a.includes(c) ? a.filter((x) => x !== c) : [...a, c]))} />

            <section className="card overflow-hidden">
              {done ? (
                <div className="p-6 text-center sm:p-10" style={{ animation: "fadeUp .6s cubic-bezier(.2,.7,.2,1) both" }}>
                  <CheckCircle2 className="mx-auto h-10 w-10 text-gold-600" />
                  <h2 className="mt-3 font-display text-3xl font-semibold">Request sent. Salamat!</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">A PAPH travel consultant will prepare your official offer. Keep your reference number to check its status anytime.</p>
                  <p className="mt-5 inline-block rounded-2xl border border-gold-300 bg-gold-50 px-6 py-3 font-display text-3xl font-semibold tracking-wide text-ink-900">{done.ref}</p>
                  <div className="mt-6"><Link className="btn-primary px-6 py-3" to={`/track/${done.ref}?c=${encodeURIComponent(done.contact)}`}>Track this request<ArrowRight className="h-4 w-4" /></Link></div>
                </div>
              ) : (
                <form onSubmit={submit} className="grid gap-6 p-5 sm:p-8 md:grid-cols-[1fr_1.1fr]">
                  <div>
                    <p className="eyebrow">Next step</p>
                    <h2 className="mt-1 font-display text-3xl font-semibold leading-tight">Send this to a PAPH travel consultant</h2>
                    <p className="mt-2 text-sm text-ink-500">They check live prices, adjust the plan with you, and send an official quotation. Sending this is free and does not book anything yet.</p>
                  </div>
                  <div className="space-y-3">
                    <label className="block"><span className="label">Your name</span><input className="input" required maxLength={120} autoComplete="name" value={who.name} onChange={(e) => setWho({ ...who, name: e.target.value })} /></label>
                    <label className="block"><span className="label">Mobile number or email</span><input className="input" required maxLength={160} autoComplete="email" value={who.contact} onChange={(e) => setWho({ ...who, contact: e.target.value })} placeholder="0917 123 4567 or you@email.com" /><span className="mt-1 block text-xs text-ink-400">Used to send your offer and to look up your request.</span></label>
                    <ErrorBox error={err} />
                    <button className="btn-primary w-full py-3" disabled={busy}><Send className="h-4 w-4" />{busy ? "Sending…" : "Send my request"}</button>
                  </div>
                </form>
              )}
            </section>
          </div>
        )}
        {!f && (
          <section className="grid gap-4 py-12 sm:grid-cols-3">
            {[
              ["trip", "Tell us your trip", "Where, how long, who is coming, and the hotel level you like."],
              ["ai", "See your AI estimate", "A price range per person, three options side by side, a day-by-day plan and visa checklist."],
              ["offer", "Get your official offer", "A travel consultant prepares it, a travel agent approves it, and you receive a quotation."],
            ].map(([n, t, d], i) => (
              <div key={n} className="card p-6" style={{ animation: `fadeUp .8s cubic-bezier(.2,.7,.2,1) ${0.2 + i * 0.1}s both` }}>
                <p className="font-display text-xl font-semibold">{t}</p>
                <p className="mt-1 text-sm text-ink-500">{d}</p>
              </div>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
