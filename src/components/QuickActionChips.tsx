/**
 * QuickActionChips — Cluely.com mode row (segmented pill).
 */
import type { ComponentType } from "react";
import { Sparkles, MessageCircle, ListRestart, RotateCcw } from "lucide-react";
import { cn } from "../lib/utils";

export type QuickAction = "assist" | "say" | "followup" | "recap";

interface QuickActionChipsProps {
  active?: QuickAction;
  onSelect?: (action: QuickAction) => void;
}

const CHIPS: Array<{
  value: QuickAction;
  label: string;
  short: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { value: "assist", label: "Assist", short: "Assist", icon: Sparkles },
  { value: "say", label: "What should I say?", short: "Say", icon: MessageCircle },
  { value: "followup", label: "Follow-up questions", short: "Follow-up", icon: ListRestart },
  { value: "recap", label: "Recap", short: "Recap", icon: RotateCcw },
];

export function QuickActionChips({ active, onSelect }: QuickActionChipsProps) {
  return (
    <div
      className={cn(
        "flex gap-0.5 p-0.5 rounded-full",
        "bg-zinc-950/70 border border-white/[0.06]",
        "overflow-x-auto scrollbar-thin max-w-full",
      )}
      role="tablist"
      aria-label="Assistant mode"
    >
      {CHIPS.map(({ value, label, short, icon: Icon }) => {
        const selected = active === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect?.(value)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium",
              "whitespace-nowrap transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
              selected
                ? "bg-zinc-100 text-zinc-900 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80",
            )}
            title={label}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{short}</span>
          </button>
        );
      })}
    </div>
  );
}