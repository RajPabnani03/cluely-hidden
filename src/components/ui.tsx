import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface CardShellProps {
  children: ReactNode;
  className?: string;
  /** Panel opacity 0.4–1.0 (glass strength). */
  opacity?: number;
}

export function CardShell({ children, className, opacity = 0.95 }: CardShellProps) {
  const alpha = Math.min(1, Math.max(0.4, opacity));
  return (
    <div
      className={cn(
        "w-full max-w-[440px] flex flex-col rounded-[20px] overflow-hidden",
        "backdrop-blur-xl border border-white/[0.08]",
        "shadow-[0_20px_50px_rgba(0,0,0,0.5)]",
        className,
      )}
      style={{ backgroundColor: `rgba(24, 24, 27, ${alpha})` }}
    >
      {children}
    </div>
  );
}
