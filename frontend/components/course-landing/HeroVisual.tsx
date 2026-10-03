import { Award, Layers } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { pad2 } from "@/lib/course";

// Abstract "learning network" for the Demystifying AI for Everyone hero: a central spark with
// three orbits of connected nodes (concept → application → impact). Pure SVG +
// CSS — no animation library; motion is disabled by prefers-reduced-motion.

const C = 200;
type Pt = { x: number; y: number };

function ring(r: number, count: number, offsetDeg: number): Pt[] {
  return Array.from({ length: count }, (_, i) => {
    const a = ((offsetDeg + (360 / count) * i) * Math.PI) / 180;
    return { x: +(C + r * Math.cos(a)).toFixed(2), y: +(C + r * Math.sin(a)).toFixed(2) };
  });
}
function nearest(p: Pt, pts: Pt[]): Pt {
  return pts.reduce((b, q) => (Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? q : b));
}

const R1 = ring(68, 4, 20);
const R2 = ring(122, 6, 5);
const R3 = ring(176, 9, 32);
const EDGES: [Pt, Pt][] = [
  ...R1.map((p): [Pt, Pt] => [{ x: C, y: C }, p]),
  ...R2.map((p): [Pt, Pt] => [p, nearest(p, R1)]),
  ...R3.map((p): [Pt, Pt] => [p, nearest(p, R2)]),
];

export function HeroVisual({
  firstModuleTitle,
  moduleCount,
}: {
  firstModuleTitle?: string;
  moduleCount: number;
}) {
  return (
    <div className="relative mx-auto w-full max-w-[460px] aspect-square" aria-hidden>
      <div
        className="absolute inset-[8%] rounded-full blur-3xl opacity-70"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--primary) 22%, transparent), transparent)",
        }}
      />
      <svg viewBox="0 0 400 400" className="relative w-full h-full overflow-visible">
        <defs>
          <radialGradient id="hv-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.55" />
          </radialGradient>
        </defs>

        {[68, 122, 176].map((r, i) => (
          <circle
            key={r}
            cx={C}
            cy={C}
            r={r}
            fill="none"
            stroke="var(--foreground)"
            strokeOpacity={0.09 - i * 0.015}
            strokeDasharray={i === 2 ? "2 6" : undefined}
          />
        ))}

        <g className="hv-orbit">
          {EDGES.map(([a, b], i) => (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--primary)"
              strokeOpacity={0.28}
              strokeWidth={1}
            />
          ))}
          {R3.map((p, i) => (
            <circle key={`o${i}`} cx={p.x} cy={p.y} r={4} fill="var(--card)" stroke="var(--primary)" strokeOpacity={0.5} />
          ))}
          {R2.map((p, i) => (
            <circle
              key={`m${i}`}
              cx={p.x}
              cy={p.y}
              r={6}
              fill="var(--primary)"
              fillOpacity={i % 2 ? 0.35 : 0.75}
              className={i % 3 === 0 ? "hv-pulse" : undefined}
              style={{ animationDelay: `${i * 0.4}s` }}
            />
          ))}
          {R1.map((p, i) => (
            <circle key={`i${i}`} cx={p.x} cy={p.y} r={8} fill="var(--card)" stroke="var(--primary)" strokeWidth={2} />
          ))}
        </g>

        <circle cx={C} cy={C} r={34} fill="url(#hv-core)" />
        <circle cx={C} cy={C} r={44} fill="none" stroke="var(--primary)" strokeOpacity={0.25} />
      </svg>

      {/* Central spark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <BrandMark size="lg" variant="bare" className="rounded-full" />
      </div>

      {/* Real course facts floating on the visual */}
      <div className="absolute left-0 top-[12%] max-w-[62%] glass rounded-2xl border border-border shadow-soft px-3.5 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-600">Module 01</p>
        <p className="text-[13px] font-medium text-foreground leading-snug line-clamp-2">
          {firstModuleTitle ?? "Demystifying AI for Everyone"}
        </p>
      </div>
      <div className="absolute right-0 bottom-[14%] glass rounded-2xl border border-border shadow-soft px-3.5 py-2.5 flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-xl bg-violet-600/10 text-violet-600 flex items-center justify-center">
          <Award className="w-4 h-4" />
        </span>
        <div>
          <p className="text-[13px] font-medium text-foreground leading-tight">Certificate</p>
          <p className="text-[11px] text-muted-foreground">QR-verifiable</p>
        </div>
      </div>
      {moduleCount > 0 && (
        <div className="absolute left-[6%] bottom-[4%] glass rounded-full border border-border shadow-soft px-3 py-1.5 flex items-center gap-1.5 text-[12px] font-medium text-foreground">
          <Layers className="w-3.5 h-3.5 text-violet-600" /> {pad2(moduleCount)} modules
        </div>
      )}
    </div>
  );
}
