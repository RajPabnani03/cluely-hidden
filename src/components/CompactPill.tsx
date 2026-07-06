import { ChevronUp, Mic, Wifi } from "lucide-react";
import { cn } from "../lib/utils";
import { CardShell } from "./ui";

interface CompactPillProps {
  opacity: number;
  stealthTier: string;
  sessionActive: boolean;
  statusLabel: string;
  preview: string;
  onExpand: () => void;
  onOpenSettings: () => void;
}

/** Minimal Pluely-style floating pill when overlay layout is `compact`. */
export function CompactPill({
  opacity,
  stealthTier,
  sessionActive,
  statusLabel,
  preview,
  onExpand,
  onOpenSettings,
}: CompactPillProps) {
  const snippet =
    preview.trim().slice(0, 120) || "Tap expand for full assistant…";

  return (
    <div className="h-full w-full flex items-start justify-center p-3 bg-transparent">
      <CardShell
        className="max-w-[420px] w-full"
        opacity={opacity}
        data-tauri-drag-region
      >
        <div
          className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]"
          data-tauri-drag-region
        >
          <div className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
            <span className="text-zinc-900 text-[9px] font-bold">C</span>
          </div>
          <span className="text-[10px] font-semibold text-zinc-300 uppercase tracking-wide">
            {stealthTier}
          </span>
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border",
              sessionActive
                ? "text-blue-200 border-blue-500/40 bg-blue-500/10"
                : "text-zinc-400 border-zinc-700/60",
            )}
          >
            {sessionActive ? (
              <Mic className="w-3 h-3" />
            ) : (
              <Wifi className="w-3 h-3" />
            )}
            {statusLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={onExpand}
          className="w-full text-left px-3 py-2.5 text-[11px] text-zinc-300 line-clamp-2 hover:bg-zinc-800/40 transition-colors"
          data-tauri-no-drag
        >
          {snippet}
        </button>
        <div
          className="flex items-center justify-between px-2 py-1.5 border-t border-white/[0.06]"
          data-tauri-no-drag
        >
          <button
            type="button"
            onClick={onExpand}
            className="inline-flex items-center gap-1 text-[10px] text-blue-300 hover:text-blue-200 px-2 py-1 rounded-lg hover:bg-zinc-800"
          >
            <ChevronUp className="w-3 h-3" />
            Expand
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="text-[10px] text-zinc-500 hover:text-zinc-200 px-2 py-1"
          >
            Settings
          </button>
        </div>
      </CardShell>
    </div>
  );
}