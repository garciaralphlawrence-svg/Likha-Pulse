// Opening motion graphic: a gold pulse line draws itself, customer messages drift up,
// and the promise "Your sentiments are important to us." writes in letter by letter.
import { useEffect, useState } from "react";

const BUBBLES: { t: string; c: string; x: number; d: number }[] = [
  { t: "Ang ganda ng service!", c: "#2f7d62", x: 6, d: 0 },
  { t: "Sobrang tagal ng reply…", c: "#b4544a", x: 74, d: 0.6 },
  { t: "Salamat po! 💛", c: "#2f7d62", x: 20, d: 1.4 },
  { t: "Magkano po ito?", c: "#a99f8f", x: 86, d: 2.1 },
  { t: "Highly recommend!", c: "#2f7d62", x: 12, d: 2.7 },
  { t: "Wala pa rin po refund ko", c: "#b4544a", x: 78, d: 3.2 },
  { t: "Super accommodating staff", c: "#2f7d62", x: 4, d: 3.9 },
  { t: "Pwede po bang magtanong?", c: "#a99f8f", x: 82, d: 4.5 },
  { t: "Babalik ako!", c: "#2f7d62", x: 16, d: 5.0 },
];
const LINE1 = "Your sentiments";
const LINE2a = "are ";
const LINE2b = "important";
const LINE2c = " to us.";
const KEY = "pulse.intro.seen";

function Letters({ text, start, className = "" }: { text: string; start: number; className?: string }) {
  return (
    <>
      {Array.from(text).map((ch, i) => (
        <span key={i} className={`inline-block ${className}`} style={{ animation: `letterIn .7s cubic-bezier(.2,.7,.2,1) ${start + i * 0.035}s both`, whiteSpace: "pre" }}>{ch}</span>
      ))}
    </>
  );
}

export default function Intro() {
  const [show, setShow] = useState(() => {
    try { return !sessionStorage.getItem(KEY) && !matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
  });
  const [leaving, setLeaving] = useState(false);

  const close = () => {
    if (leaving) return;
    setLeaving(true);
    try { sessionStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setTimeout(() => setShow(false), 950);
  };
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(close, 6800);
    const k = (e: KeyboardEvent) => (e.key === "Enter" || e.key === "Escape") && close();
    window.addEventListener("keydown", k);
    return () => { clearTimeout(t); window.removeEventListener("keydown", k); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);
  if (!show) return null;

  const l2 = 1.55 + LINE1.length * 0.035;
  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-ink-950 text-ivory-50" role="dialog" aria-label="Welcome to Likha Pulse"
      style={leaving ? { animation: "curtainUp .95s cubic-bezier(.7,0,.2,1) forwards" } : undefined}>
      {/* soft gold light */}
      <div className="glow-orb pointer-events-none absolute -left-40 top-1/4 h-[34rem] w-[34rem] rounded-full bg-gold-500/20 blur-3xl" />
      <div className="glow-orb pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-gold-300/10 blur-3xl" style={{ animationDelay: "-3s" }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(#d9c39a 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

      {/* drifting customer messages */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-full" aria-hidden>
        {BUBBLES.map((b, i) => (
          <div key={i} className="absolute bottom-[8%] hidden sm:block" style={{ left: `${b.x}%`, animation: `floatUp 4.6s ease-out ${b.d}s infinite both` }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[13px] text-ivory-100/80 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: b.c }} />{b.t}
            </span>
          </div>
        ))}
      </div>

      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        {/* pulse line drawing itself */}
        <div className="relative mb-8 h-20 w-[min(560px,88vw)]">
          <svg viewBox="0 0 560 80" className="h-full w-full" aria-hidden>
            <defs><linearGradient id="pl" x1="0" x2="1"><stop offset="0" stopColor="#b8975a" stopOpacity="0" /><stop offset=".25" stopColor="#d9c39a" /><stop offset=".75" stopColor="#d9c39a" /><stop offset="1" stopColor="#b8975a" stopOpacity="0" /></linearGradient></defs>
            <path d="M0 44 H200 L222 44 L238 14 L258 72 L276 30 L290 44 H560" fill="none" stroke="url(#pl)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="760" strokeDashoffset="760" style={{ animation: "draw 1.6s cubic-bezier(.6,0,.2,1) .2s forwards" }} />
          </svg>
          <span className="absolute left-[46%] top-[18%] h-6 w-6 rounded-full border border-gold-300" style={{ animation: "ringOut 1.4s ease-out 1.1s 2 both" }} />
        </div>

        <p className="mb-5 text-[11px] uppercase tracking-[0.42em] text-gold-300" style={{ animation: "fadeIn 1s ease 1.1s both" }}>Likha Pulse</p>
        <h1 className="font-display text-[clamp(2.6rem,7vw,5.6rem)] font-semibold leading-[1.02]">
          <span className="block"><Letters text={LINE1} start={1.5} /></span>
          <span className="block">
            <Letters text={LINE2a} start={l2} />
            <span className="italic text-gold-300" style={{ textShadow: "0 0 28px rgba(217,195,154,.45)" }}><Letters text={LINE2b} start={l2 + 0.14} /></span>
            <Letters text={LINE2c} start={l2 + 0.5} />
          </span>
        </h1>
        <p className="mt-7 max-w-xl text-[15px] leading-relaxed text-ivory-200/70 sm:text-lg" style={{ animation: "fadeUp 1s cubic-bezier(.2,.7,.2,1) 3.3s both" }}>
          Every review, comment and chat is read with care, so you always know how your customers truly feel.
        </p>
        <button onClick={close} className="btn mt-9 border border-gold-300/50 bg-gold-500/10 px-7 py-3 text-ivory-50 hover:bg-gold-500/25" style={{ animation: "fadeUp .9s cubic-bezier(.2,.7,.2,1) 3.9s both" }}>
          Enter
        </button>
      </div>

      <button onClick={close} className="absolute right-5 top-5 text-xs uppercase tracking-[0.2em] text-ivory-200/50 hover:text-ivory-100" style={{ animation: "fadeIn 1s ease .4s both" }}>Skip</button>
      <div className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-gold-700 via-gold-300 to-gold-700" style={{ animation: "barGrow 6.8s linear both", width: "100%", transformOrigin: "left" }} />
    </div>
  );
}
