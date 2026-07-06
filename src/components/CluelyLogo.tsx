/** Cluely wordmark + icon — matches cluely.com hero card. */
import { cn } from "../lib/utils";

export function CluelyLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center",
          "bg-gradient-to-b from-zinc-50 to-zinc-200",
          "shadow-[0_1px_2px_rgba(0,0,0,0.35)]",
        )}
        aria-hidden
      >
        <span className="text-zinc-900 text-[11px] font-bold tracking-tight">C</span>
      </div>
      <span className="text-[13px] font-semibold text-zinc-100 tracking-[-0.02em]">
        Cluely
      </span>
    </div>
  );
}