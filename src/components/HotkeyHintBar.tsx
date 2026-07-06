import { Command } from "lucide-react";
import { cn } from "../lib/utils";

export interface HotkeyHint {
  /** Display label, e.g. "Hide", "Stop session", "Assist" */
  label: string;
  /** Keyboard combo parts. Each part renders as a keycap. */
  keys: string[];
}

interface HotkeyHintBarProps {
  hints: HotkeyHint[];
  className?: string;
}

/**
 * Inline hotkey hint bar — the small "⌘ ↑ ↑ ↑ ↑" row Cluely shows
 * above the response area. Renders each hint as a label + keycap row.
 *
 * Pure presentational; the parent decides which hints are relevant
 * for the current mode.
 */
export function HotkeyHintBar({ hints, className }: HotkeyHintBarProps) {
  if (hints.length === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2",
        "border-t border-white/[0.06]",
        "text-[10.5px] text-zinc-400",
        className,
      )}
    >
      {hints.map((hint, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <span className="text-zinc-500">{hint.label}</span>
          <div className="flex items-center gap-0.5">
            {hint.keys.map((key, kidx) => (
              <KeyCap key={kidx}>{key}</KeyCap>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1",
        "rounded-[5px] bg-zinc-800 border border-zinc-700/60",
        "text-[10px] font-medium text-zinc-200 leading-none",
      )}
    >
      {children === "Cmd" ? <Command className="w-2.5 h-2.5" /> : children}
    </span>
  );
}