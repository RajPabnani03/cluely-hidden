/** Teleprompter strip — large speakable answer from dual-brain (Sprint C). */
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
        "rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 py-2.5",
        "shadow-[0_0_24px_rgba(16,185,129,0.08)]",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="text-[10px] uppercase tracking-widest text-emerald-400/90 mb-1">
        Say this
      </div>
      <p className="text-[15px] sm:text-base font-medium text-emerald-50 leading-snug">
        {text}
      </p>
    </div>
  );
}