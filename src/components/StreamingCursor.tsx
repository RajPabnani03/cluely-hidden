import { cn } from "../lib/utils";

/** Blinking caret at the end of streaming assistant text. */
export function StreamingCursor({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block w-[2px] h-[1em] ml-0.5 align-text-bottom rounded-sm bg-blue-400/90 animate-stream-caret",
        className,
      )}
      aria-hidden
    />
  );
}