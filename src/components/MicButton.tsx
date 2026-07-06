import { Mic, MicOff } from "lucide-react";
import { cn } from "../lib/utils";
import { setMicGate } from "../lib/tauri";

interface MicButtonProps {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
  title?: string;
  vadMode?: "aggressive" | "balanced" | "manual";
}

export function MicButton({
  isRecording,
  onStart,
  onStop,
  disabled = false,
  title,
  vadMode = "balanced",
}: MicButtonProps) {
  const handleClick = () => {
    if (disabled) return;
    if (isRecording) onStop();
    else onStart();
  };

  const manual = vadMode === "manual";

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={() => {
        if (manual && isRecording) {
          void setMicGate(true).catch(console.error);
        }
      }}
      onPointerUp={() => {
        if (manual && isRecording) {
          void setMicGate(false).catch(console.error);
        }
      }}
      onPointerLeave={() => {
        if (manual && isRecording) {
          void setMicGate(false).catch(console.error);
        }
      }}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50",
        isRecording
          ? "bg-red-600/90 hover:bg-red-500 text-white border border-red-500/50"
          : "text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60",
      )}
      aria-pressed={isRecording}
      aria-label={isRecording ? "Stop microphone" : "Start microphone"}
    >
      {isRecording ? (
        <MicOff className="w-3.5 h-3.5" />
      ) : (
        <Mic className="w-3.5 h-3.5" />
      )}
      {isRecording ? "Stop mic" : "Mic"}
    </button>
  );
}