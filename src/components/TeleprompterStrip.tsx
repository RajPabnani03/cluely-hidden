/** Teleprompter — primary “say this” hero (Cluely focal response). */
import { cn } from "../lib/utils";

export function TeleprompterStrip({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  if (!text.trim()) return null;
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-zinc-950/40 px-4 py-3",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500 mb-2">
        AI response
      </p>
      <p className="text-[17px] font-medium text-zinc-50 leading-[1.45] tracking-[-0.01em]">
        {text}
      </p>
    </div>
  );
}