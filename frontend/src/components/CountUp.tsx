import { useEffect, useState } from "react";

/** Animates a number from 0 to its value (keeps any suffix like "%"). */
export default function CountUp({ value, duration = 1200 }: { value: string | number; duration?: number }) {
  const str = String(value);
  const m = /^(-?[\d,]*\.?\d+)(.*)$/.exec(str);
  const target = m ? parseFloat(m[1].replace(/,/g, "")) : NaN;
  const decimals = m && m[1].includes(".") ? m[1].split(".")[1].length : 0;
  const [n, setN] = useState(0);
  useEffect(() => {
    if (isNaN(target)) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      setN(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  if (isNaN(target)) return <>{str}</>;
  return <>{n.toLocaleString("en-PH", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{m![2]}</>;
}
