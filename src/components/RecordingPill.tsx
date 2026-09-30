import { useEffect, useState } from "react";
import { Circle } from "lucide-react";
import { cn } from "../lib/utils";

interface RecordingPillProps {
  /** Whether recording is active. When true, the elapsed timer ticks. */
  active: boolean;
  /** Session start epoch (ms). Falls back to mount time when absent. */
  startedAt?: number | null;
  /** Optional label override (default: "Recording"). */
  label?: string;
}

/**
 * Recording timer pill — matches the official Cluely UX.
 *
 * Shows a pulsing red dot + label + mm:ss timer. Ticks every second
 * while `active` is true; resets to 00:00 when deactivated.
 */
export function RecordingPill({
  active,
  startedAt,
  label = "Recording",
}: RecordingPillProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const start = startedAt ?? Date.now();
    setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    const id = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [active, startedAt]);

  if (!active) return null;

  const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const seconds = (elapsed % 60).toString().padStart(2, "0");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
        "bg-zinc-900/80 border border-white/[0.08] backdrop-blur-xl",
        "text-[11px] font-medium text-zinc-100",
      )}
    >
      <Circle className="w-2 h-2 fill-red-500 text-red-500 animate-pulse" />
      <span>{label}</span>
      <span className="font-mono text-zinc-300 tabular-nums">
        {minutes}:{seconds}
      </span>
    </span>
  );
}