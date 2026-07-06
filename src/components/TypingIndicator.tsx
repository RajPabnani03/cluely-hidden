import { cn } from "../lib/utils";

/** Three-dot pulse shown while waiting for the first streamed token. */
export function TypingIndicator({ className }: { className?: string }) {
  return (
    <div
      className={cn("inline-flex items-center gap-1 py-1", className)}
      role="status"
      aria-label="Assistant is typing"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-typing-dot"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </div>
  );
}