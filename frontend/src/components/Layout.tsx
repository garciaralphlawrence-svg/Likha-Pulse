import clsx from "clsx";
import { AlertTriangle, BarChart3, Bell, Brain, FileText, Gauge, LogOut, Menu, MessageSquareText, Plug, ScrollText, Settings, ShieldCheck, Users, X } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { api, IS_DEMO } from "../api";
import type { Notice } from "../api/types";
import { useAuth } from "../lib/auth";
import { fmtDate } from "../lib/format";
import { resetDemo } from "../demo/demoApi";

const NAV = [
  { to: "/", label: "Dashboard", icon: Gauge, perm: "dashboard.view" },
  { to: "/feedback", label: "Feedback Monitoring", icon: MessageSquareText, perm: "feedback.view" },
  { to: "/sentiment", label: "Sentiment Analysis", icon: BarChart3, perm: "feedback.view" },
  { to: "/insights", label: "AI Insights", icon: Brain, perm: "dashboard.view" },
  { to: "/priority", label: "Priority Concerns", icon: AlertTriangle, perm: "feedback.view" },
  { to: "/reports", label: "Reports", icon: FileText, perm: "reports.view" },
  { to: "/integrations", label: "Platform Integrations", icon: Plug, perm: "dashboard.view" },
  { to: "/users", label: "User Management", icon: Users, perm: "users.manage" },
  { to: "/settings", label: "System Settings", icon: Settings, perm: "settings.manage" },
  { to: "/audit", label: "Audit Logs", icon: ScrollText, perm: "audit.view" },
];

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden><rect width="32" height="32" rx="7" fill={light ? "#16294f" : "#0f1f3d"} /><path d="M5 17h5l3-7 5 13 3-6h6" stroke="#34d399" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <div className="leading-tight"><div className={clsx("text-sm font-semibold", light ? "text-white" : "text-slate-900")}>Likha Pulse</div><div className={clsx("text-[11px]", light ? "text-slate-400" : "text-slate-500")}>Feedback Intelligence</div></div>
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ unread: number; items: Notice[] }>({ unread: 0, items: [] });
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const load = () => api.notifications().then(setData).catch(() => undefined);
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const sev: Record<string, string> = { critical: "bg-red-600", high: "bg-orange-500", medium: "bg-amber-400", low: "bg-slate-400" };
  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost relative p-2" onClick={() => setOpen(!open)} aria-label={`Notifications, ${data.unread} unread`}>
        <Bell className="h-5 w-5" />
        {data.unread > 0 && <span className="absolute right-1 top-1 min-w-[16px] rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white">{data.unread > 99 ? "99+" : data.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-96 max-w-[90vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            <button className="text-xs font-medium text-navy-700 hover:underline" onClick={() => api.markAllRead().then(load)}>Mark all read</button>
          </div>
          <ul className="max-h-[420px] overflow-y-auto">
            {data.items.length === 0 && <li className="p-6 text-center text-sm text-slate-500">No alerts yet.</li>}
            {data.items.map((n) => (
              <li key={n.id}>
                <button className={clsx("flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50", !n.read && "bg-blue-50/40")}
                  onClick={() => { api.markRead(n.id).then(load); setOpen(false); if (n.feedback_id) nav(`/feedback?open=${n.feedback_id}`); }}>
                  <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", sev[n.severity] ?? "bg-slate-400")} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800">{n.title}</span>
                    <span className="line-clamp-2 block text-xs text-slate-500">{n.message}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">{fmtDate(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, can, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const items = NAV.filter((n) => can(n.perm));
  const side = (
    <nav className="flex h-full flex-col bg-navy-950 text-slate-300">
      <div className="px-5 py-5"><Logo light /></div>
      <ul className="flex-1 space-y-0.5 px-3">
        {items.map((n) => (
          <li key={n.to}>
            <NavLink to={n.to} end={n.to === "/"} onClick={() => setMenu(false)}
              className={({ isActive }) => clsx("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition", isActive ? "bg-navy-800 font-medium text-white" : "hover:bg-navy-900 hover:text-white")}>
              <n.icon className="h-4 w-4 shrink-0" />{n.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="border-t border-navy-800 px-5 py-4 text-xs text-slate-400">
        <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />{user?.role.replace("_", " ")}</div>
        <div className="mt-1 truncate">{user?.email}</div>
      </div>
    </nav>
  );
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{side}</aside>
      {menu && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenu(false)} /><div className="relative h-full w-64">{side}</div></div>}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-6">
        <button className="btn-ghost p-2 lg:hidden" onClick={() => setMenu(!menu)} aria-label="Menu">{menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        <div className="lg:hidden"><Logo /></div>
        {IS_DEMO && (
          <div className="hidden items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800 ring-1 ring-amber-200 md:flex">
            Demo · runs in your browser with labeled sample data
            <button className="font-semibold underline" onClick={() => { resetDemo(); location.reload(); }}>Reset</button>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Notifications />
          <div className="hidden text-right sm:block"><div className="text-sm font-medium text-slate-800">{user?.full_name}</div><div className="text-[11px] text-slate-500">{user?.role.replace("_", " ")}</div></div>
          <button className="btn-ghost p-2" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] p-4 lg:p-6">{children}</main>
    </div>
  );
}
