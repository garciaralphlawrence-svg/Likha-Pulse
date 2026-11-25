import clsx from "clsx";
import { Bell, FileText, Inbox, LayoutDashboard, LogOut, Menu, Plug, ScrollText, Settings, Siren, Sparkles, Users, Wand2, X } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { api, IS_DEMO } from "../api";
import type { Notice } from "../api/types";
import { resetDemo } from "../demo/demoApi";
import { useAuth } from "../lib/auth";
import { ago } from "../lib/format";

const NAV = [
  { group: "Daily", items: [
    { to: "/", label: "Overview", icon: LayoutDashboard, perm: "dashboard.view" },
    { to: "/feedback", label: "Inbox", hint: "Comments & chats", icon: Inbox, perm: "feedback.view" },
    { to: "/priority", label: "Needs Attention", icon: Siren, perm: "feedback.view" },
    { to: "/insights", label: "AI Summary", icon: Sparkles, perm: "dashboard.view" },
  ] },
  { group: "Tools", items: [
    { to: "/sentiment", label: "Ask the AI", icon: Wand2, perm: "feedback.view" },
    { to: "/reports", label: "Reports", icon: FileText, perm: "reports.view" },
    { to: "/integrations", label: "Connections", icon: Plug, perm: "dashboard.view" },
  ] },
  { group: "Admin", items: [
    { to: "/users", label: "Team", icon: Users, perm: "users.manage" },
    { to: "/settings", label: "Settings", icon: Settings, perm: "settings.manage" },
    { to: "/audit", label: "Activity", icon: ScrollText, perm: "audit.view" },
  ] },
];

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={clsx("grid h-10 w-10 place-items-center rounded-xl ring-1", light ? "bg-gradient-to-br from-gold-500 to-gold-700 ring-gold-300/40" : "bg-ink-900 ring-ink-700")}>
        <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden><path d="M4 17h5l3-8 5 14 3-7h8" stroke={light ? "#fcfaf6" : "#d9c39a"} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <div className="leading-tight">
        <div className={clsx("font-display text-2xl font-semibold", light ? "text-ivory-50" : "text-ink-900")}>Likha Pulse</div>
        <div className={clsx("text-[10px] uppercase tracking-[0.22em]", light ? "text-gold-300" : "text-gold-600")}>Customer Intelligence</div>
      </div>
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
  const sev: Record<string, string> = { critical: "bg-red-700", high: "bg-orange-600", medium: "bg-gold-500", low: "bg-ink-400" };
  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost relative p-2.5" onClick={() => setOpen(!open)} aria-label={`Alerts, ${data.unread} unread`}>
        <Bell className="h-5 w-5" />
        {data.unread > 0 && <span className="absolute right-1.5 top-1.5 min-w-[17px] rounded-full bg-gold-500 px-1 text-[10px] font-semibold leading-[17px] text-white">{data.unread > 99 ? "99+" : data.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[380px] max-w-[92vw] overflow-hidden rounded-2xl border border-ivory-200 bg-ivory-50 shadow-lift">
          <div className="flex items-center justify-between border-b border-ivory-200 px-5 py-3">
            <span className="font-display text-xl font-semibold">Alerts</span>
            <button className="text-xs font-medium text-gold-700 hover:underline" onClick={() => api.markAllRead().then(load)}>Mark all as read</button>
          </div>
          <ul className="max-h-[430px] overflow-y-auto">
            {data.items.length === 0 && <li className="p-8 text-center text-sm text-ink-400">You're all caught up.</li>}
            {data.items.map((n) => (
              <li key={n.id}>
                <button className={clsx("flex w-full gap-3 px-5 py-3.5 text-left transition hover:bg-white", !n.read && "bg-gold-50/60")}
                  onClick={() => { api.markRead(n.id).then(load); setOpen(false); if (n.feedback_id) nav(`/feedback?open=${n.feedback_id}`); }}>
                  <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", sev[n.severity] ?? "bg-ink-400")} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink-900">{n.title}</span>
                    <span className="line-clamp-2 block text-xs text-ink-500">{n.message.split("\nReason:")[0]}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-400">{ago(n.created_at)}</span>
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
  const initials = (user?.full_name ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("");
  const side = (
    <nav className="relative flex h-full flex-col overflow-hidden bg-ink-950 text-ink-400">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl" />
      <div className="relative px-6 pb-6 pt-7"><Logo light /></div>
      <div className="relative flex-1 space-y-6 overflow-y-auto px-4">
        {NAV.map((g) => {
          const items = g.items.filter((n) => can(n.perm));
          if (!items.length) return null;
          return (
            <div key={g.group}>
              <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.24em] text-ink-500">{g.group}</p>
              <ul className="space-y-0.5">
                {items.map((n) => (
                  <li key={n.to}>
                    <NavLink to={n.to} end={n.to === "/"} onClick={() => setMenu(false)}
                      className={({ isActive }) => clsx("group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                        isActive ? "bg-white/[0.06] text-ivory-50 shadow-[inset_2px_0_0_#b8975a]" : "hover:bg-white/[0.04] hover:text-ivory-100")}>
                      {({ isActive }) => (<><n.icon className={clsx("h-[18px] w-[18px] shrink-0", isActive ? "text-gold-300" : "text-ink-500 group-hover:text-gold-300")} />{n.label}</>)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="relative m-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gold-500/20 text-sm font-semibold text-gold-300">{initials}</span>
          <div className="min-w-0"><div className="truncate text-sm font-medium text-ivory-100">{user?.full_name}</div><div className="truncate text-[11px] text-ink-500">{user?.role.replace("_", " ").toLowerCase()}</div></div>
        </div>
      </div>
    </nav>
  );
  return (
    <div className="min-h-screen lg:pl-72">
      <aside className="fixed inset-y-0 left-0 hidden w-72 lg:block">{side}</aside>
      {menu && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-ink-950/50" onClick={() => setMenu(false)} /><div className="relative h-full w-72">{side}</div></div>}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ivory-200/80 bg-ivory-100/85 px-4 backdrop-blur-md lg:px-10">
        <button className="btn-ghost p-2 lg:hidden" onClick={() => setMenu(!menu)} aria-label="Menu">{menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        <div className="lg:hidden"><Logo /></div>
        <p className="hidden text-sm text-ink-400 lg:block">{new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}</p>
        {IS_DEMO && (
          <div className="ml-4 hidden items-center gap-2 rounded-full border border-gold-300/60 bg-gold-50 px-3 py-1 text-xs text-gold-700 md:flex">
            Preview with sample messages
            <button className="font-semibold underline" onClick={() => { resetDemo(); location.reload(); }}>Reset</button>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Notifications />
          <button className="btn-ghost p-2.5" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut className="h-[18px] w-[18px]" /></button>
        </div>
      </header>
      <main className="mx-auto max-w-[1320px] px-4 py-8 lg:px-10">{children}</main>
    </div>
  );
}
