import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export interface CardShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Shared card shell for the floating overlay card and secondary sheets.
 *
 * Matches the official Cluely UX:
 *   - rounded-[20px]
 *   - dark zinc glass (bg-zinc-900/95, backdrop-blur)
 *   - subtle border (white/8%)
 *   - heavy shadow
 */
export function CardShell({ children, className }: CardShellProps) {
  return (
    <div
      className={cn(
        "w-full max-w-[420px] flex flex-col rounded-[20px] overflow-hidden",
        "bg-zinc-900/95 backdrop-blur-xl border border-white/[0.08]",
        "shadow-[0_20px_50px_rgba(0,0,0,0.5)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface SheetShellProps {
  children: ReactNode;
  onClose?: () => void;
}

/**
 * Centered modal sheet wrapper used for Settings/History/Help overlays.
 */
export function SheetShell({ children, onClose }: SheetShellProps) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      {children}
    </div>
  );
}

interface SheetHeaderProps {
  title: string;
  onClose: () => void;
}

export function SheetHeader({ title, onClose }: SheetHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
      <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
      <button
        onClick={onClose}
        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
        aria-label="Close"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </header>
  );
}

export interface SectionProps {
  title: string;
  children: ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </section>
  );
}
