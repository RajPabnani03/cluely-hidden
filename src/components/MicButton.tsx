import { Mic, MicOff } from "lucide-react";
import { cn } from "../lib/utils";

interface MicButtonProps {
  /** Whether the microphone capture is currently active. */
  isRecording: boolean;
  /** Called when the user requests to start mic capture. */
  onStart: () => void;
  /** Called when the user requests to stop mic capture. */
  onStop: () => void;
  /** Disable interaction (e.g. while a session is not ready). */
  disabled?: boolean;
  /** Optional tooltip / aria-label override. */
  title?: string;
  /** Additional className passthrough for layout. */
  className?: string;
}

/**
 * MicButton — large round control that toggles real microphone capture.
 *
 * Visual states:
 *   idle         — neutral zinc-800 with zinc-700/60 border
 *   recording    — pulsing red ring, red icon, "Stop mic" tooltip
 *   disabled     — dimmed, no hover scale, cursor-not-allowed
 *
 * Mirrors the chrome polish used across the overlay (RecordingPill,
 * LiveStatusBadge) — zinc base, blue/red accents, subtle hover scale.
 */
export function MicButton({
  isRecording,
  onStart,
  onStop,
  disabled,
  title,
  className,
}: MicButtonProps) {
  const handleClick = () => {
    if (disabled) return;
    if (isRecording) {
      onStop();
    } else {
      onStart();
    }
  };

  const label = title ?? (isRecording ? "Stop mic" : "Start mic");

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-pressed={isRecording}
      aria-label={label}
      title={label}
      className={cn(
        "relative shrink-0 w-11 h-11 flex items-center justify-center rounded-full",
        "border transition-all duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60",
        // Idle vs recording palette.
        isRecording
          ? "bg-red-500/10 border-red-500/50 text-red-300"
          : "bg-zinc-800 border-zinc-700/60 text-zinc-200 hover:bg-zinc-700 hover:scale-105",
        // Disabled state.
        disabled && "opacity-40 cursor-not-allowed hover:bg-zinc-800 hover:scale-100",
        className,
      )}
    >
      {/* Pulsing ring when recording. */}
      {isRecording && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full border-2 border-red-500/60 animate-ping"
        />
      )}
      <span className="relative">
        {isRecording ? (
          <MicOff className="w-4.5 h-4.5" />
        ) : (
          <Mic className="w-4.5 h-4.5" />
        )}
      </span>
    </button>
  );
}
