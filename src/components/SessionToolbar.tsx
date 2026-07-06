/**
 * Slim live-session controls — one row, not a dev console panel.
 */
import { Camera, Mic, MicOff, StopCircle, Volume2 } from "lucide-react";
import { MicButton } from "./MicButton";
import { cn } from "../lib/utils";

export interface SessionToolbarProps {
  sessionActive: boolean;
  busy: boolean;
  isMicRecording: boolean;
  audioPlaying: boolean;
  vadMode: "aggressive" | "balanced" | "manual";
  onStartSession: () => void;
  onStopSession: () => void;
  onCapture: () => void;
  onStartMic: () => void;
  onStopMic: () => void;
  transcript?: string;
  error?: string | null;
  expandedDetails?: boolean;
  onToggleDetails?: () => void;
  captureHint?: string | null;
}

export function SessionToolbar({
  sessionActive,
  busy,
  isMicRecording,
  audioPlaying,
  vadMode,
  onStartSession,
  onStopSession,
  onCapture,
  onStartMic,
  onStopMic,
  transcript,
  error,
  expandedDetails,
  onToggleDetails,
  captureHint,
}: SessionToolbarProps) {
  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex items-center gap-1.5 flex-wrap",
          "rounded-2xl border border-white/[0.06] bg-zinc-950/50 px-2 py-1.5",
        )}
      >
        {!sessionActive ? (
          <button
            type="button"
            onClick={onStartSession}
            disabled={busy}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold",
              "bg-zinc-100 text-zinc-900 hover:bg-white transition-colors",
              "disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60",
            )}
          >
            <Mic className="w-3.5 h-3.5" />
            Start listening
          </button>
        ) : (
          <button
            type="button"
            onClick={onStopSession}
            disabled={busy}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium",
              "text-zinc-300 hover:text-red-200 hover:bg-red-500/10 border border-transparent",
              "transition-colors disabled:opacity-50",
            )}
          >
            <StopCircle className="w-3.5 h-3.5" />
            Stop
          </button>
        )}

        <button
          type="button"
          onClick={onCapture}
          disabled={busy}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium",
            "text-zinc-300 border border-white/[0.08] bg-zinc-900/80",
            "hover:bg-zinc-800 hover:text-zinc-100 transition-colors disabled:opacity-50",
          )}
          title="Capture screen"
        >
          <Camera className="w-3.5 h-3.5" />
          Screen
        </button>

        <MicButton
          isRecording={isMicRecording}
          onStart={onStartMic}
          onStop={onStopMic}
          disabled={!sessionActive || busy}
          vadMode={vadMode}
          className="!rounded-full !px-2.5 !py-1.5 !text-[11px]"
        />

        {captureHint ? (
          <span className="text-[10px] text-zinc-600 tabular-nums">{captureHint}</span>
        ) : null}

        {sessionActive && (
          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 ml-auto">
            {audioPlaying ? (
              <>
                <Volume2 className="w-3 h-3 text-blue-400 animate-pulse" />
                Speaking
              </>
            ) : isMicRecording ? (
              <>
                <Mic className="w-3 h-3 text-emerald-400" />
                Mic on
              </>
            ) : (
              <>
                <MicOff className="w-3 h-3" />
                Mic off
              </>
            )}
          </span>
        )}

        {(transcript || error) && onToggleDetails ? (
          <button
            type="button"
            onClick={onToggleDetails}
            className="text-[10px] text-zinc-500 hover:text-zinc-300"
          >
            {expandedDetails ? "Hide details" : "Details"}
          </button>
        ) : null}
      </div>

      {expandedDetails && error ? (
        <p className="text-[11px] text-red-300/90 px-1" role="alert">
          {error}
        </p>
      ) : null}
      {expandedDetails && transcript ? (
        <div className="rounded-xl border border-white/[0.06] bg-zinc-950/60 px-3 py-2 max-h-24 overflow-y-auto scrollbar-thin">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
            Heard
          </p>
          <p className="text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed">
            {transcript}
          </p>
        </div>
      ) : null}
    </div>
  );
}