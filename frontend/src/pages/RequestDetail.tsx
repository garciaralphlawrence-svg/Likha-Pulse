import clsx from "clsx";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, FileText, HelpCircle, Plus, Save, Send, Trash2, UserCheck, X } from "lucide-react";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import type { CaseView, RequestDetail as RD, StaffMember } from "../api/types";
import { ClockChip, StagePill, SuggestedReplies, timeLeft } from "../components/clock";
import { replyKey } from "../quote/care";
import RecommendationView, { BudgetBox, Compare, Verdict } from "../components/Recommendation";
import { Card, ErrorBox, Modal, SampleTag, Spinner, StatusBadge, Tag } from "../components/ui";
import { useAuth } from "../lib/auth";
import { ago, fmtDate, peso } from "../lib/format";
import { MONTHS, fmtDay, paxText, destByCode } from "../quote/engine";
import { ACTIONS, ActionCode, ActionPayload, DEFAULT_SETTINGS, LOST_REASONS, OfferLine, STATUSES, Settings, totals } from "../quote/workflow";

const EVENT_WORD: Record<string, string> = { reply: "Replied to the customer", customer_feedback: "Customer rated the trip", save_offer: "Offer saved", assign: "Assigned", customer_question: "Customer asked a question", answer: "Question answered", send: "Sent to customer" };
const ROLE_WORD: Record<string, string> = { ADMIN: "Owner", AGENT: "Agent", SALES: "Sales", CUSTOMER: "Customer", SYSTEM: "AI" };
const num = (s: string) => { const n = parseInt(s.replace(/[^\d-]/g, ""), 10); return Number.isFinite(n) ? n : 0; };

function MoneyInput({ value, onChange, disabled, label }: { value: number; onChange: (n: number) => void; disabled?: boolean; label: string }) {
  const [txt, setTxt] = useState(value.toLocaleString("en-PH"));
  useEffect(() => setTxt(value.toLocaleString("en-PH")), [value]);
  return <input aria-label={label} disabled={disabled} inputMode="numeric" className="input px-2 py-1.5 text-right tabular-nums disabled:bg-ivory-50" value={txt}
    onChange={(e) => setTxt(e.target.value)} onBlur={() => onChange(num(txt))} />;
}

function Totals({ t, minMargin }: { t: ReturnType<typeof totals>; minMargin: number }) {
  const row = (label: string, value: ReactNode, cls = "") => <div className={clsx("flex items-center justify-between gap-3 py-1.5 text-sm", cls)}><span className="text-ink-500">{label}</span><span className="tabular-nums">{value}</span></div>;
  return (
    <div className="rounded-2xl bg-ivory-50 p-4 ring-1 ring-ivory-200">
      {row("PAPH cost", peso(t.cost))}
      {t.discount > 0 && row("Discount", `-${peso(t.discount)}`)}
      {row("Customer pays", <b className="font-display text-xl">{peso(t.price)}</b>)}
      {row("Per person", peso(t.per_person), "text-xs")}
      {row("Margin", <span className={clsx("font-semibold", t.below_cost ? "text-red-700" : t.low_margin ? "text-gold-700" : "text-emerald-700")}>{peso(t.margin)} ({t.margin_pct}%)</span>)}
      {t.ai_check !== "none" && row("AI range", `${peso(t.ai_low)}–${peso(t.ai_high)}`, "text-xs")}
      <div className="mt-2 space-y-1.5">
        {t.below_cost && <p className="flex gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800"><AlertTriangle className="h-4 w-4 shrink-0" />Below cost by {peso(t.cost - t.price)}. This cannot be sent or approved.</p>}
        {t.low_margin && <p className="flex gap-2 rounded-xl bg-gold-50 px-3 py-2 text-xs text-gold-700"><AlertTriangle className="h-4 w-4 shrink-0" />Margin under {minMargin}%. The agent must write a reason to approve it.</p>}
        {t.ai_check === "below" && <p className="rounded-xl bg-ivory-100 px-3 py-2 text-xs text-ink-600">{peso(t.ai_gap)} under the AI range. Double-check the costs.</p>}
        {t.ai_check === "above" && <p className="rounded-xl bg-ivory-100 px-3 py-2 text-xs text-ink-600">{peso(t.ai_gap)} above the AI range. Make sure the customer sees the value.</p>}
        {t.ai_check === "inside" && !t.below_cost && !t.low_margin && <p className="flex gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><Check className="h-4 w-4 shrink-0" />Inside the AI range, healthy margin.</p>}
      </div>
    </div>
  );
}

export default function RequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [r, setR] = useState<RD | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ lines: OfferLine[]; discount: number; notes: string } | null>(null);
  const [note, setNote] = useState("");
  const [modal, setModal] = useState<null | "lost" | "answer" | "decide">(null);
  const [decision, setDecision] = useState<ActionCode>("approve");
  const [reason, setReason] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const [cases, setCases] = useState<CaseView[]>([]);
  const [replying, setReplying] = useState(false);
  const loadCases = () => Promise.all([api.cases("open"), api.cases("solved")]).then(([a, b]) => setCases([...a.items, ...b.items].filter((c) => c.request_id === id))).catch(() => undefined);

  useEffect(() => {
    api.request(id!).then((x) => { setR(x); setPick(x.recommendation.recommended); }).catch(setErr);
    api.settings().then(setSettings).catch(() => undefined);
    api.staff().then(setStaff).catch(() => undefined);
    loadCases();
  }, [id]);
  useEffect(() => { if (r?.offer) setDraft({ lines: r.offer.lines.map((l) => ({ ...l })), discount: r.offer.discount, notes: r.offer.notes }); else setDraft(null); }, [r?.offer?.version, r?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = useMemo(() => (r && draft ? totals(r, { ...draft, option: r.offer?.option ?? null }, settings) : null), [r, draft, settings]);
  if (err && !r) return <ErrorBox error={err} />;
  if (!r || !user) return <Spinner />;

  const can = (a: ActionCode) => r.allowed.includes(a);
  const editable = can("save_offer");
  const dirty = !!(r.offer && draft && JSON.stringify({ l: draft.lines, d: draft.discount, n: draft.notes }) !== JSON.stringify({ l: r.offer.lines, d: r.offer.discount, n: r.offer.notes }));
  const run = async (action: ActionCode, payload: ActionPayload = {}, msg = "") => {
    setBusy(true); setErr(null);
    try { const next = await api.act(r.id, action, payload); setR(next); setModal(null); setNote(""); setReason(""); setFlash(msg || `${ACTIONS[action].label}: done.`); setTimeout(() => setFlash(""), 3500); return next; }
    catch (x) { setErr(x); return null; } finally { setBusy(false); }
  };
  const saveThenSubmit = async () => {
    if (dirty) { const s = await run("save_offer", { ...draft! }, "Saved."); if (!s) return; if (s.status !== "offer_drafted") return; }
    await run("submit", {}, "Sent to the travel agent for approval.");
  };
  const upd = (i: number, patch: Partial<OfferLine>) => setDraft((d) => d && ({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const d = destByCode(r.input.destination);
  const salespeople = staff.filter((s) => s.role === "SALES" || s.role === "ADMIN");
  const t = r.offer?.totals;
  const awaitingMe = can("approve");

  return (
    <div className="space-y-6">
      <Link to={awaitingMe ? "/staff/approvals" : "/staff/requests"} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"><ArrowLeft className="h-4 w-4" />Back</Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold tracking-wide text-ink-400">{r.ref}</span><StatusBadge status={r.status} />{r.is_sample && <SampleTag />}
            {r.clock && <ClockChip clock={r.clock} now={new Date().toISOString()} />}{r.expired && <Tag tone="red">Expired: recheck rates</Tag>}</div>
          <h1 className="mt-1 font-display text-3xl font-semibold leading-tight sm:text-4xl">{r.customer.name}</h1>
          <p className="text-sm text-ink-500">{r.customer.contact} · sent {ago(r.created_at)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {r.terms && <Link className="btn-secondary" to={`/staff/quote/${r.id}`}><FileText className="h-4 w-4" />Quotation</Link>}
          {can("assign") && user.role === "SALES" && r.assignee?.id !== user.id && <button className="btn-secondary" disabled={busy} onClick={() => run("assign", { assignee: { id: user.id, name: user.full_name } }, "It's yours.")}><UserCheck className="h-4 w-4" />Take this request</button>}
          {can("assign") && user.role !== "SALES" && (
            <select className="input w-auto py-2" aria-label="Assign to" value={r.assignee?.id ?? ""} onChange={(e) => { const s = staff.find((x) => x.id === e.target.value); if (s) run("assign", { assignee: { id: s.id, name: s.name } }); }}>
              <option value="" disabled>Assign to…</option>
              {salespeople.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {!can("assign") && r.assignee && <span className="text-sm text-ink-500">Handled by {r.assignee.name}</span>}
        </div>
      </header>
      {flash && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900" style={{ animation: "fadeUp .4s both" }}><CheckCircle2 className="h-4 w-4" />{flash}</div>}
      <ErrorBox error={err} />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Card title="What the customer asked">
            <blockquote className="rounded-xl border-l-2 border-gold-500 bg-ivory-50 px-4 py-3 font-display text-lg italic text-ink-800">“{r.raw_text || "Filled in the form"}”</blockquote>
            <p className="mt-3 text-sm text-ink-600">{d?.name ?? r.input.place_text ?? "No destination yet"} · {r.input.days} days · {paxText(r.input.adults, r.input.kids)}
              {r.input.travel_date ? ` · leaving ${fmtDay(r.input.travel_date)}` : r.input.month ? ` · ${MONTHS[r.input.month - 1]}` : ""}{r.input.budget ? ` · budget ${peso(r.input.budget)}${r.input.budget_per_person ? " per person" : ""}` : ""}</p>
            {r.addons.length > 0 && <p className="mt-1 text-sm text-ink-500">Add-ons: {r.addons.map((c) => r.recommendation.addons.find((a) => a.code === c)?.label).filter(Boolean).join(", ")}</p>}
          </Card>

          {can("reply") && (r.clock || replying) && (
            <div className="rounded-2xl border border-ivory-200 bg-white p-4">
              {replying ? (
                <SuggestedReplies situation={r.customer_question ? replyKey(r.customer_question.text) : r.status === "changes_requested" ? "changes" : r.offer ? "offer_follow_up" : "price"}
                  ctx={{ name: r.customer.name.replace(/^Sample: /, ""), ref: r.ref, range: r.recommendation.options.find((o) => o.code === r.recommendation.recommended) ? `${peso(r.recommendation.options.find((o) => o.code === r.recommendation.recommended)!.pp_low)} to ${peso(r.recommendation.options.find((o) => o.code === r.recommendation.recommended)!.pp_high)}` : undefined, valid: r.approval ? fmtDay(r.approval.valid_until.slice(0, 10)) : undefined }}
                  onReplied={() => { setReplying(false); run("reply", {}, "Reply recorded. The clock has stopped."); }} />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-ink-600">{r.clock ? <>The customer is waiting for a reply ({r.clock.label.toLowerCase()}): <b>{timeLeft(r.clock.due_at, new Date().toISOString())}</b>.</> : "Reply to the customer."}</p>
                  <button className="btn-primary" onClick={() => setReplying(true)}>Reply to the customer</button>
                </div>
              )}
            </div>
          )}

          {r.customer_question && (
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-gold-300 bg-gold-50 p-4">
              <p className="flex gap-2 text-sm"><HelpCircle className="h-5 w-5 shrink-0 text-gold-600" /><span><b>Customer asked:</b> {r.customer_question.text}<span className="block text-xs text-ink-400">{ago(r.customer_question.at)}</span></span></p>
              {can("answer") && <button className="btn-secondary" onClick={() => setModal("answer")}>Mark as answered</button>}
            </div>
          )}

          {!r.offer && (
            <Card title="Offer" subtitle={can("start_offer") ? "Start from one of the AI options. You can change every line after." : "No offer yet. A salesperson will prepare it."}>
              {can("start_offer") ? (
                <div className="space-y-3">
                  {r.recommendation.options.length ? (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {r.recommendation.options.map((o) => (
                        <button key={o.code} onClick={() => setPick(o.code)} className={clsx("rounded-xl border p-4 text-left transition", pick === o.code ? "border-gold-500 bg-gold-50 ring-2 ring-gold-100" : "border-ivory-300 bg-white hover:border-gold-300")}>
                          <span className="block font-display text-lg font-semibold">{o.label}</span>
                          <span className="block text-xs text-ink-500">{o.tier_label} hotel{o.recommended ? " · best match" : ""}</span>
                          <span className="mt-2 block text-sm font-semibold">{peso(o.total_low)}–{peso(o.total_high)}</span>
                        </button>
                      ))}
                    </div>
                  ) : <p className="text-sm text-ink-500">No sample rates for this place. Start a blank offer and add the lines yourself.</p>}
                  <button className="btn-primary" disabled={busy} onClick={() => run("start_offer", { option: r.recommendation.options.length ? pick : null }, "Offer started. Adjust the lines, then send for approval.")}>Start the offer</button>
                </div>
              ) : <p className="text-sm text-ink-500">Waiting for a salesperson.</p>}
            </Card>
          )}

          {r.offer && draft && live && (
            <Card title={`Offer${r.offer.option ? `: ${r.recommendation.options.find((o) => o.code === r.offer!.option)?.label ?? ""}` : ""}`}
              subtitle={`Version ${r.offer.version} · last saved by ${r.offer.updated_by} ${ago(r.offer.updated_at)}`}>
              {editable && (r.status === "approved" || r.status === "sent") && <p className="mb-3 rounded-xl bg-gold-50 px-3 py-2 text-xs text-gold-700">This offer is already approved. Saving a change sends it back to the travel agent for approval.</p>}
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[560px] text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-400"><th className="pb-2 font-medium">Item</th><th className="w-28 pb-2 text-right font-medium">Our cost</th><th className="w-28 pb-2 text-right font-medium">Customer price</th>{editable && <th className="w-8" />}</tr></thead>
                  <tbody>
                    {draft.lines.map((l, i) => (
                      <tr key={l.id} className="border-t border-ivory-200 align-top">
                        <td className="py-2 pr-2">
                          {editable ? (<><input className="input px-2 py-1.5 font-medium" aria-label="Item name" value={l.label} onChange={(e) => upd(i, { label: e.target.value })} /><input className="input mt-1 px-2 py-1 text-xs text-ink-500" aria-label="Item details" value={l.detail} onChange={(e) => upd(i, { detail: e.target.value })} /></>)
                            : (<><span className="font-medium">{l.label}</span><span className="block text-xs text-ink-400">{l.detail}</span></>)}
                        </td>
                        <td className="py-2 pl-1">{editable ? <MoneyInput label="Cost" value={l.cost} onChange={(n) => upd(i, { cost: n })} /> : <span className="block text-right tabular-nums">{peso(l.cost)}</span>}</td>
                        <td className="py-2 pl-1">{editable ? <MoneyInput label="Price" value={l.price} onChange={(n) => upd(i, { price: n })} /> : <span className="block text-right tabular-nums">{peso(l.price)}</span>}</td>
                        {editable && <td className="py-2 pl-1"><button className="btn-ghost p-1.5" aria-label="Remove line" onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {editable && <button className="btn-ghost mt-2 text-gold-700" onClick={() => setDraft({ ...draft, lines: [...draft.lines, { id: `n${Date.now()}`, kind: "other", label: "New item", detail: "", cost: 0, price: 0 }] })}><Plus className="h-4 w-4" />Add a line</button>}
              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
                <div className="space-y-3">
                  <label className="block"><span className="label">Discount (₱)</span><MoneyInput label="Discount" disabled={!editable} value={draft.discount} onChange={(n) => setDraft({ ...draft, discount: Math.max(0, n) })} /></label>
                  <label className="block"><span className="label">Note for the customer</span><textarea className="input min-h-[84px]" disabled={!editable} maxLength={1000} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="e.g. Rates held until the validity date. Breakfast included." /></label>
                </div>
                <Totals t={live} minMargin={settings.min_margin_pct} />
              </div>
              {editable && (
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button className="btn-secondary" disabled={busy || !dirty} onClick={() => run("save_offer", { ...draft }, r.status === "approved" || r.status === "sent" ? "Saved. Sent back for approval." : "Saved.")}><Save className="h-4 w-4" />Save changes</button>
                  {(can("submit") || r.status === "offer_drafted") && <button className="btn-primary" disabled={busy || live.below_cost || live.price <= 0} onClick={saveThenSubmit}><Send className="h-4 w-4" />Send for approval</button>}
                </div>
              )}
            </Card>
          )}

          {awaitingMe && t && (
            <Card title="Your decision" subtitle={`Prepared by ${r.submitted_by?.name ?? "sales"}. Sales cannot finalize an offer alone.`} className="ring-2 ring-sky-100">
              <ul className="grid gap-3 text-sm sm:grid-cols-3">
                <li className="rounded-xl bg-ivory-50 p-3"><span className="label">Customer pays</span><b className="font-display text-2xl">{peso(t.price)}</b></li>
                <li className="rounded-xl bg-ivory-50 p-3"><span className="label">Margin</span><b className={clsx("font-display text-2xl", t.below_cost ? "text-red-700" : t.low_margin ? "text-gold-700" : "text-emerald-700")}>{t.margin_pct}%</b><span className="block text-xs text-ink-400">{peso(t.margin)} · minimum {settings.min_margin_pct}%</span></li>
                <li className="rounded-xl bg-ivory-50 p-3"><span className="label">Against the AI range</span><b className="text-sm">{t.ai_check === "inside" ? "Inside the range" : t.ai_check === "below" ? `${peso(t.ai_gap)} below` : t.ai_check === "above" ? `${peso(t.ai_gap)} above` : "No AI range"}</b>{t.ai_check !== "none" && <span className="block text-xs text-ink-400">{peso(t.ai_low)}–{peso(t.ai_high)}</span>}</li>
              </ul>
              {r.submitted_by?.id === user.id && <p className="mt-3 rounded-xl bg-gold-50 px-3 py-2 text-xs text-gold-700">You prepared this offer, so another agent must approve it.</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-gold" disabled={busy || t.below_cost || r.submitted_by?.id === user.id} onClick={() => { if (t.low_margin) { setDecision("approve"); setModal("decide"); } else run("approve", {}, "Approved. The quotation is ready."); }}><Check className="h-4 w-4" />Approve</button>
                <button className="btn-secondary" disabled={busy} onClick={() => { setDecision("request_changes"); setModal("decide"); }}>Ask for changes</button>
                <button className="btn-danger" disabled={busy} onClick={() => { setDecision("decline"); setModal("decide"); }}><X className="h-4 w-4" />Decline</button>
              </div>
            </Card>
          )}

          {(can("send") || can("mark_booked") || can("mark_lost")) && (
            <div className="flex flex-wrap gap-2">
              {can("send") && <button className="btn-primary" disabled={busy || r.expired} onClick={() => run("send", {}, "Marked as sent to the customer.")}><Send className="h-4 w-4" />Mark as sent to customer</button>}
              {can("mark_booked") && <button className="btn-gold" disabled={busy} onClick={() => run("mark_booked", {}, "Booked!")}><CheckCircle2 className="h-4 w-4" />Mark as booked (deposit received)</button>}
              {can("mark_lost") && <button className="btn-ghost" onClick={() => setModal("lost")}>Mark as lost</button>}
            </div>
          )}

          <Card title="Response Clock cases" subtitle="Customer issues on this request"
            action={<button className="btn-secondary py-1.5" disabled={busy} onClick={async () => {
              const text = window.prompt("What is the customer's problem?", r.customer_question?.text ?? "");
              if (!text?.trim()) return;
              try { await api.openCase({ request_id: r.id, text: text.trim(), source: "manual" }); loadCases(); setFlash("Case opened. The clock has started."); } catch (x) { setErr(x); }
            }}>Open a case</button>}>
            {cases.length ? <ul className="space-y-2">{cases.map((c) => (
              <li key={c.id}><Link to={`/staff/clock?open=${c.id}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-ivory-200 bg-white px-3 py-2 text-sm hover:border-gold-300">
                <StagePill stage={c.stage} small /><span className="font-medium">{c.situation_label}</span><span className="min-w-0 flex-1 truncate text-ink-500">“{c.text}”</span><span className="text-xs text-ink-400">{c.owner?.name ?? "Nobody yet"}</span>
              </Link></li>))}</ul> : <p className="text-sm text-ink-400">No cases. Unhappy messages from this customer open one automatically.</p>}
          </Card>

          <Card title="History" subtitle="Every step, who did it and why.">
            <ol className="relative space-y-4 border-l border-ivory-300 pl-5">
              {[...r.events].reverse().map((e, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-gold-500 ring-4 ring-white" />
                  <p className="text-sm"><b className="font-medium">{e.to && e.from !== e.to ? STATUSES[e.to].staff : EVENT_WORD[e.action] ?? ACTIONS[e.action as ActionCode]?.label ?? e.action}</b>
                    <span className="text-ink-400"> · {e.by} ({ROLE_WORD[e.role] ?? e.role}) · {fmtDate(e.at)}</span></p>
                  {e.note && <p className="mt-0.5 text-sm text-ink-600">{e.note}</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <aside className="min-w-0 space-y-5">
          <Verdict rec={r.recommendation} />
          <BudgetBox rec={r.recommendation} />
          {r.recommendation.options.length > 0 && <Compare rec={r.recommendation} selected={r.offer?.option ?? r.recommendation.recommended ?? "value"} onSelect={() => undefined} />}
          <details className="card group p-5">
            <summary className="cursor-pointer list-none text-sm font-medium text-gold-700">See the full AI plan, itinerary and visa checklist</summary>
            <div className="mt-4"><RecommendationView rec={r.recommendation} addons={r.addons} /></div>
          </details>
        </aside>
      </div>

      <Modal open={modal === "decide"} onClose={() => setModal(null)} title={decision === "approve" ? "Approve with a thin margin" : decision === "decline" ? "Decline this offer" : "Ask sales for changes"}>
        <p className="mb-2 text-sm text-ink-500">{decision === "approve" ? `The margin is ${t?.margin_pct}%, under the ${settings.min_margin_pct}% minimum. Write why it is okay.` : "Write a short note. Sales will see it on the request."}</p>
        <textarea className="input min-h-[110px]" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={decision === "approve" ? "e.g. Repeat customer, group booking" : decision === "decline" ? "e.g. Hotels fully booked on those dates" : "e.g. Use the budget hotel and drop one tour"} />
        <div className="mt-4 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
          <button className={decision === "decline" ? "btn-danger" : "btn-primary"} disabled={!note.trim() || busy} onClick={() => run(decision, { note }, decision === "approve" ? "Approved. The quotation is ready." : decision === "decline" ? "Declined." : "Sent back to sales with your note.")}>{ACTIONS[decision].label}</button></div>
      </Modal>
      <Modal open={modal === "answer"} onClose={() => setModal(null)} title="What did you tell the customer?">
        <textarea className="input min-h-[110px]" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Yes po, daily breakfast for 2 is included." />
        <p className="mt-2 text-xs text-ink-400">The customer sees this answer on their tracking page.</p>
        <div className="mt-4 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn-primary" disabled={!note.trim() || busy} onClick={() => run("answer", { note }, "Answer saved.")}>Save answer</button></div>
      </Modal>
      <Modal open={modal === "lost"} onClose={() => setModal(null)} title="Why was this request lost?">
        <div className="space-y-2">{Object.entries(LOST_REASONS).map(([k, v]) => <label key={k} className={clsx("flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm", reason === k ? "border-gold-500 bg-gold-50" : "border-ivory-300 bg-white")}><input type="radio" name="lost" className="accent-[#8c6d36]" checked={reason === k} onChange={() => setReason(k)} />{v}</label>)}</div>
        <textarea className="input mt-3 min-h-[70px]" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else (optional)" />
        <div className="mt-4 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn-danger" disabled={!reason || busy} onClick={() => run("mark_lost", { reason, note }, "Marked as lost.")}>Mark as lost</button></div>
      </Modal>
    </div>
  );
}
