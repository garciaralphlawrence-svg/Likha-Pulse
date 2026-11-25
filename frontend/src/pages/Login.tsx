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
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-navy-950 p-10 text-slate-300 lg:flex">
        <Logo light />
        <div>
          <h1 className="max-w-md text-3xl font-semibold leading-tight text-white">Understand every review, comment and message, without reading them one by one.</h1>
          <ul className="mt-6 space-y-2 text-sm">
            <li>• Sentiment, emotion, intent and topic for English, Filipino and Taglish</li>
            <li>• Sarcasm flags and urgency detection with a written reason for each</li>
            <li>• Human review, audit trail, insights and PDF/Excel/CSV reports</li>
          </ul>
        </div>
        <p className="text-xs text-slate-500">A Likha Studio product</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div className="lg:hidden"><Logo /></div>
          <div><h2 className="text-xl font-semibold text-slate-900">Sign in</h2><p className="text-sm text-slate-500">Use your Likha Pulse account.</p></div>
          <label className="block"><span className="label">Email</span><input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="block"><span className="label">Password</span><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          <ErrorBox error={err} />
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          {IS_DEMO && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">Public demo</p>
              <p className="mt-0.5">Runs entirely in your browser with clearly labeled sample data. No platform is connected. Try a role:</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DEMO_ACCOUNTS.map((a) => <button type="button" key={a.email} className="rounded border border-amber-300 bg-white px-2 py-1 font-medium hover:bg-amber-100" onClick={() => { setEmail(a.email); setPassword(a.password); }}>{a.role.replace("_", " ")}</button>)}
              </div>
            </div>
          )}
          {!IS_DEMO && <p className="text-xs text-slate-500">Forgot your password? Ask a Super Admin to reset it, or use the reset-code flow described in the administrator guide.</p>}
        </form>
      </div>
    </div>
  );
}
