import { Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { IS_DEMO } from "../api";
import { Logo } from "../components/Layout";
import { ErrorBox } from "../components/ui";
import { DEMO_ACCOUNTS } from "../demo/demoApi";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await login(email, password); } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink-950 p-14 text-ivory-100 lg:flex lg:flex-col lg:justify-between">
        <div className="glow-orb pointer-events-none absolute -left-32 top-1/3 h-[28rem] w-[28rem] rounded-full bg-gold-500/15 blur-3xl" />
        <div className="relative"><Link to="/"><Logo light /></Link></div>
        <div className="relative max-w-lg">
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-gold-300"><Sparkles className="h-3.5 w-3.5" />Staff workspace</p>
          <h1 className="mt-4 font-display text-6xl font-semibold leading-[1.02] text-ivory-50">The AI prices it. Sales offers it. The agent decides.</h1>
          <p className="mt-6 text-lg leading-relaxed text-ivory-200/70">Every customer request arrives with an AI price range and a suggested plan. Salespeople turn it into an offer, and a travel agent approves it before the customer gets a quotation.</p>
        </div>
        <p className="relative text-xs tracking-[0.2em] text-ink-500">PAPH TRAVEL AND TOURS</p>
      </div>
      <div className="flex items-center justify-center bg-ivory-100 p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-10 lg:hidden"><Link to="/"><Logo /></Link></div>
          <p className="eyebrow">Staff only</p>
          <h2 className="mt-1 font-display text-4xl font-semibold text-ink-900">Sign in</h2>
          <div className="mt-8 space-y-4">
            <label className="block"><span className="label">Email</span><input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label className="block"><span className="label">Password</span><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            <ErrorBox error={err} />
            <button className="btn-primary w-full py-3" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </div>
          {IS_DEMO && (
            <div className="mt-8 rounded-2xl border border-gold-300/60 bg-gold-50 p-4 text-sm text-ink-700">
              <p className="font-medium text-gold-700">Sample accounts for this preview</p>
              <p className="mt-1 text-xs text-ink-500">Tap one to fill in the sign-in form.</p>
              <ul className="mt-3 space-y-1.5">
                {DEMO_ACCOUNTS.map((a) => (
                  <li key={a.email}>
                    <button type="button" className="flex w-full flex-wrap items-center justify-between gap-x-3 rounded-xl border border-gold-300 bg-white px-3 py-2 text-left text-xs hover:bg-gold-100" onClick={() => { setEmail(a.email); setPassword(a.password); }}>
                      <span className="font-semibold">{a.label}</span><span className="text-ink-500">{a.email} · {a.password}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!IS_DEMO && <p className="mt-6 text-xs text-ink-400">Forgot your password? Ask the owner to reset it for you.</p>}
          <p className="mt-6 text-center text-xs"><Link className="text-ink-500 underline underline-offset-2" to="/">Back to the customer page</Link></p>
        </form>
      </div>
    </div>
  );
}
