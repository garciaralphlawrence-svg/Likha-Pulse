import { Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { IS_DEMO } from "../api";
import { Logo } from "../components/Layout";
import { ErrorBox } from "../components/ui";
import { DEMO_ACCOUNTS } from "../demo/demoApi";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState(IS_DEMO ? DEMO_ACCOUNTS[0].email : "");
  const [password, setPassword] = useState(IS_DEMO ? DEMO_ACCOUNTS[0].password : "");
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await login(email, password); } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink-950 p-14 text-ivory-100 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-32 top-1/3 h-[28rem] w-[28rem] rounded-full bg-gold-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gold-300/10 blur-3xl" />
        <div className="relative"><Logo light /></div>
        <div className="relative max-w-lg">
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-gold-300"><Sparkles className="h-3.5 w-3.5" />AI that reads your customers</p>
          <h1 className="mt-4 font-display text-6xl font-semibold leading-[1.02] text-ivory-50">Know what every customer feels — without reading every message.</h1>
          <p className="mt-6 text-lg leading-relaxed text-ivory-200/70">Google reviews, Facebook comments and Messenger chats, reviewed by AI in English, Tagalog and Taglish. You get a short briefing of what matters and what to do next.</p>
          <div className="mt-10 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur">
            <p className="font-display text-xl italic text-ivory-100">“Okay naman ang service pero sobrang tagal ng reply.”</p>
            <p className="mt-3 text-sm text-gold-300">AI: Frustrated customer is complaining about response time.</p>
          </div>
        </div>
        <p className="relative text-xs tracking-[0.2em] text-ink-500">A LIKHA STUDIO PRODUCT</p>
      </div>
      <div className="flex items-center justify-center bg-ivory-100 p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-10 lg:hidden"><Logo /></div>
          <p className="eyebrow">Welcome back</p>
          <h2 className="mt-1 font-display text-4xl font-semibold text-ink-900">Sign in</h2>
          <div className="mt-8 space-y-4">
            <label className="block"><span className="label">Email</span><input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label className="block"><span className="label">Password</span><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            <ErrorBox error={err} />
            <button className="btn-primary w-full py-3" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </div>
          {IS_DEMO && (
            <div className="mt-8 rounded-2xl border border-gold-300/60 bg-gold-50 p-4 text-sm text-ink-700">
              <p className="font-medium text-gold-700">Preview with sample messages</p>
              <p className="mt-1 text-xs text-ink-500">Choose how you want to look around:</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((a) => <button type="button" key={a.email} className="rounded-full border border-gold-300 bg-white px-3 py-1 text-xs font-medium hover:bg-gold-100" onClick={() => { setEmail(a.email); setPassword(a.password); }}>{({ SUPER_ADMIN: "Owner", ANALYST: "Staff", VIEWER: "View only" } as Record<string, string>)[a.role]}</button>)}
              </div>
            </div>
          )}
          {!IS_DEMO && <p className="mt-6 text-xs text-ink-400">Forgot your password? Ask the account owner to reset it for you.</p>}
        </form>
      </div>
    </div>
  );
}
