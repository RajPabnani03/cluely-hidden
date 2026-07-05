/**
 * SmartToggle — the small "Smart" switch in Cluely's input bar.
 */
import { cn } from "../lib/utils";

interface SmartToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function SmartToggle({ checked, onChange }: SmartToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
      aria-pressed={checked}
    >
      <span
        className={cn(
          "relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors",
          checked ? "bg-blue-600" : "bg-zinc-600",
        )}
      >
        <span
          className={cn(
            "inline-block h-2.5 w-2.5 rounded-full bg-white transition-transform",
            checked ? "translate-x-3" : "translate-x-0.5",
          )}
        />
      </span>
      Smart
    </button>
  );
}
