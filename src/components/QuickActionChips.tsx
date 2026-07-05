/**
 * QuickActionChips — the assistant action row from the Cluely UX.
 *
 * Chips: Assist | What should I say? | Follow-up questions | Recap
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
  icon: ComponentType<{ className?: string }>;
}> = [
  { value: "assist", label: "Assist", icon: Sparkles },
  { value: "say", label: "What should I say?", icon: MessageCircle },
  { value: "followup", label: "Follow-up questions", icon: ListRestart },
  { value: "recap", label: "Recap", icon: RotateCcw },
];

export function QuickActionChips({ active, onSelect }: QuickActionChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CHIPS.map(({ value, label, icon: Icon }) => {
        const selected = active === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onSelect?.(value)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors border",
              selected
                ? "bg-zinc-700 text-white border-zinc-600"
                : "bg-zinc-800/60 text-zinc-300 border-zinc-700/60 hover:bg-zinc-800 hover:text-zinc-100",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
