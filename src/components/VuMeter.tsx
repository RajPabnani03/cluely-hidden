import { Volume2 } from "lucide-react";
import { cn } from "../lib/utils";

interface VuMeterProps {
  /**
   * Current audio level in dBFS. Typical range is -60 (silence) to 0
   * (full scale / clipping). Values below the floor render as empty.
   */
  level: number;
  /** Number of segments to render. Default: 5. */
  segments?: number;
  /** Lower bound in dBFS — anything below this shows no segments lit. */
  floor?: number;
  /** Optional className passthrough. */
  className?: string;
}

/**
 * VuMeter — 5-segment LED-style horizontal level meter.
 *
 * Thresholds map dBFS → number of lit segments:
 *   -inf…-40 dB   → 0 (off)
 *   -40 dB         → 1 (emerald)
 *   -20 dB         → 2 (emerald)
 *   -10 dB         → 3 (amber)
 *   -3 dB          → 4 (amber)
 *   ≥0 dB          → 5 (red, clipping)
 *
 * Uses a smoothed/normalized `display` value (0..1) with a
 * transition so the bar glides rather than snapping frame to frame.
 */
export function VuMeter({
  level,
  segments = 5,
  floor = -60,
  className,
}: VuMeterProps) {
  // Clamp input into [floor, 0] dBFS, then linear-map to [0, 1].
  const clamped = Math.max(floor, Math.min(0, level));
  const norm = (clamped - floor) / -floor; // 0 at floor, 1 at 0 dBFS

  // How many segments are "lit"?
  const lit = Math.round(norm * segments);

  // Show a tick above the floor as audio activity, even when norm rounds to 0.
  const active = level > floor;

  // dB readout.
  const dbText =
    Number.isFinite(level) && level > floor
      ? `${level > 0 ? "+" : ""}${level.toFixed(0)} dB`
      : "—";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-2.5 py-1 rounded-full",
        "bg-zinc-900/80 border border-white/[0.08] backdrop-blur-xl",
        className,
      )}
      role="meter"
      aria-label="Microphone level"
      aria-valuemin={floor}
      aria-valuemax={0}
      aria-valuenow={Number.isFinite(level) ? level : floor}
    >
      <Volume2
        className={cn(
          "w-3 h-3 shrink-0 transition-colors",
          active ? "text-emerald-300" : "text-zinc-500",
        )}
      />
      <div className="flex items-center gap-0.5">
        {Array.from({ length: segments }).map((_, i) => {
          const isLit = i < lit;
          // Color ramps from emerald → amber → red as we approach clipping.
          const color =
            !isLit
              ? "bg-zinc-800"
              : i < segments - 2
                ? "bg-emerald-500"
                : i < segments - 1
                  ? "bg-amber-500"
                  : "bg-red-500";
          return (
            <span
              key={i}
              className={cn(
                "w-2 h-2 rounded-[2px] transition-all duration-100",
                color,
                isLit && "shadow-[0_0_4px_currentColor]",
              )}
            />
          );
        })}
      </div>
      <span className="text-[10px] font-mono tabular-nums text-zinc-400 min-w-[44px] text-right">
        {dbText}
      </span>
    </div>
  );
}
