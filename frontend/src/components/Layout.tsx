import clsx from "clsx";
import { BarChart3, BookOpen, ClipboardCheck, Eye, FileUp, Inbox, LayoutDashboard, ListChecks, LogOut, Mail, Menu, MessageCircle, MessageSquareQuote, Plug, ScrollText, Settings, Smile, Timer, Users, Wallet, X } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { IS_DEMO } from "../api";
import { resetDemo } from "../demo/demoApi";
import { useAuth } from "../lib/auth";

export function Logo({ light = false, small = false }: { light?: boolean; small?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span className={clsx("grid shrink-0 place-items-center rounded-full ring-1", small ? "h-9 w-9" : "h-10 w-10", light ? "bg-gold-500/15 ring-gold-300/50" : "bg-ink-900 ring-ink-700")}>
        <span className={clsx("font-display font-semibold leading-none", small ? "text-lg" : "text-xl", light ? "text-gold-300" : "text-gold-300")}>P</span>
      </span>
      <span className="leading-tight">
        <span className={clsx("block font-display font-semibold tracking-[0.08em]", small ? "text-xl" : "text-2xl", light ? "text-ivory-50" : "text-ink-900")}>PAPH</span>
        <span className={clsx("block text-[10px] uppercase tracking-[0.26em]", light ? "text-gold-300" : "text-gold-600")}>Travel and Tours</span>
      </span>
    </span>
  );
}

export function DemoNote({ className }: { className?: string }) {
  if (!IS_DEMO) return null;
  return (
    <div className={clsx("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs", className)}>
      <span>Preview with sample rates and sample requests</span>
      <button className="font-semibold underline underline-offset-2" onClick={() => { resetDemo(); location.reload(); }}>Reset</button>
    </div>
  );
}

/** Customer-facing pages: plan a trip and track a request. */
export function PublicLayout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const link = (to: string, label: string) => (
    <NavLink to={to} end className={({ isActive }) => clsx("rounded-full px-3 py-1.5 text-sm transition", isActive ? "bg-white/10 text-ivory-50" : "text-ivory-200/70 hover:text-ivory-50")}>{label}</NavLink>
  );
  return (
    <div className="min-h-screen bg-ivory-100">
      <header className="relative z-20 bg-ink-950">
        <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-4 py-4 sm:px-6">
          <Link to="/" aria-label="PAPH Travel and Tours home"><Logo light small /></Link>
          <nav className="ml-auto flex items-center gap-1">
            {link("/", "Plan a trip")}
            {link("/track", "Track")}
            <Link to="/staff" className="ml-1 hidden rounded-full border border-gold-300/40 px-3 py-1.5 text-sm text-gold-300 hover:bg-gold-500/10 sm:inline-flex">Staff</Link>
          </nav>
        </div>
      </header>
      <main key={loc.pathname} className="anim-page">{children}</main>
      <footer className="mx-auto max-w-[1180px] px-4 pb-10 pt-6 text-xs text-ink-400 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ivory-300 pt-6">
          <span>PAPH Travel and Tours · AI quotation assistant</span>
          <span className="flex items-center gap-3"><DemoNote className="text-gold-700" /><Link to="/staff" className="underline underline-offset-2 sm:hidden">Staff sign in</Link></span>
        </div>
      </footer>
    </div>
  );
}

const NAV: { group: string; items: { to: string; label: string; icon: typeof Inbox; perm: string }[] }[] = [
  { group: "Daily work", items: [
    { to: "/staff", label: "Overview", icon: LayoutDashboard, perm: "dashboard.view" },
    { to: "/staff/requests", label: "Requests", icon: Inbox, perm: "requests.view" },
    { to: "/staff/approvals", label: "Approvals", icon: ClipboardCheck, perm: "requests.approve" },
    { to: "/staff/inbox", label: "Facebook and Messenger", icon: MessageCircle, perm: "requests.view" },
    { to: "/staff/clock", label: "Response Clock", icon: Timer, perm: "requests.view" },
    { to: "/staff/replies", label: "Suggested replies", icon: MessageSquareQuote, perm: "requests.view" },
  ] },
  { group: "Owner insights", items: [
    { to: "/staff/sentiment", label: "Customer sentiment", icon: Smile, perm: "owner.view" },
    { to: "/staff/performance", label: "Team performance", icon: BarChart3, perm: "owner.view" },
    { to: "/staff/team-report", label: "Team report", icon: ListChecks, perm: "owner.view" },
    { to: "/staff/revenue", label: "Revenue and margin", icon: Wallet, perm: "owner.view" },
    { to: "/staff/watch", label: "Keyword watch", icon: Eye, perm: "owner.view" },
    { to: "/staff/weekly", label: "Weekly report", icon: Mail, perm: "owner.view" },
  ] },
  { group: "Setup", items: [
    { to: "/staff/connections", label: "Connections", icon: Plug, perm: "requests.view" },
    { to: "/staff/import", label: "Import past messages", icon: FileUp, perm: "import.manage" },
    { to: "/staff/rates", label: "Sample rates", icon: BookOpen, perm: "catalog.view" },
    { to: "/staff/team", label: "Staff accounts", icon: Users, perm: "users.manage" },
    { to: "/staff/settings", label: "Settings", icon: Settings, perm: "settings.manage" },
    { to: "/staff/activity", label: "Activity", icon: ScrollText, perm: "audit.view" },
  ] },
];
const ROLE_NAME: Record<string, string> = { ADMIN: "Owner", AGENT: "Travel agent", SALES: "Salesperson" };

export default function StaffLayout({ children }: { children: ReactNode }) {
  const { user, can, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => setMenu(false), [loc.pathname]);
  const initials = (user?.full_name ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("");
  const side = (
    <nav className="relative flex h-full flex-col overflow-hidden bg-ink-950 text-ink-400">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl" />
      <div className="relative px-6 pb-6 pt-7"><Link to="/staff"><Logo light /></Link></div>
      <div className="relative flex-1 space-y-5 overflow-y-auto px-4">
        {NAV.map((g) => {
          const items = g.items.filter((n) => can(n.perm));
          if (!items.length) return null;
          return (
            <div key={g.group}>
              <p className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-[0.24em] text-ink-500">{g.group}</p>
              <ul className="space-y-0.5">
        {items.map((n) => (
          <li key={n.to}>
            <NavLink to={n.to} end={n.to === "/staff"}
              className={({ isActive }) => clsx("group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition", isActive ? "bg-white/[0.06] text-ivory-50 shadow-[inset_2px_0_0_#b8975a]" : "hover:bg-white/[0.04] hover:text-ivory-100")}>
              {({ isActive }) => (<><n.icon className={clsx("h-[18px] w-[18px] shrink-0", isActive ? "text-gold-300" : "text-ink-500 group-hover:text-gold-300")} />{n.label}</>)}
            </NavLink>
          </li>
        ))}
              </ul>
            </div>
          );
        })}
        <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:text-ivory-100">Customer page</Link>
      </div>
      <div className="relative m-4 flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-500/20 text-sm font-semibold text-gold-300">{initials}</span>
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-ivory-100">{user?.full_name}</div><div className="truncate text-[11px] text-ink-500">{ROLE_NAME[user?.role ?? ""] ?? user?.role}</div></div>
        <button className="rounded-lg p-2 text-ink-400 hover:bg-white/5 hover:text-ivory-100" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
      </div>
    </nav>
  );
  return (
    <div className="min-h-screen bg-ivory-100 lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block print:hidden">{side}</aside>
      {menu && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-ink-950/50" onClick={() => setMenu(false)} /><div className="relative h-full w-72 max-w-[85vw]">{side}</div></div>}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ivory-200/80 bg-ivory-100/85 px-4 backdrop-blur-md lg:px-10 print:hidden">
        <button className="btn-ghost p-2 lg:hidden" onClick={() => setMenu(!menu)} aria-label="Menu">{menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        <div className="lg:hidden"><Logo small /></div>
        <p className="hidden text-sm text-ink-400 lg:block">{new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}</p>
        <DemoNote className="ml-auto hidden rounded-full border border-gold-300/60 bg-gold-50 px-3 py-1 text-gold-700 md:flex" />
      </header>
      <main key={loc.pathname} className="anim-page mx-auto max-w-[1280px] px-4 py-8 lg:px-10 print:p-0">{children}</main>
    </div>
  );
}
