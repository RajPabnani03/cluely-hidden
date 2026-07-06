/**
 * AssistantView — Cluely-style floating overlay card.
 *
 * A single vertical panel:
 *   • Header: logo pill + live-session status + Hide/Stop controls
 *   • Response area: streaming response + quick-action chips
 *   • Live Controls: Start/Stop Gemini Live session, Take screenshot,
 *     Send a demo audio chunk, plus live transcript / response feed
 *   • Input bar: Smart toggle + text input + mic/send button
 *
 * Phase 4: this view subscribes to the Rust event bus
 * (`ai:status`, `ai:transcript`, `ai:response:text`, `ai:response:audio`,
 * `ai:turn:complete`) and exposes the new IPC commands
 * (`aiStartLive`, `aiStopLive`, `aiSendAudio`, `captureScreen`).
 *
 * Uses the zinc palette + glassmorphism from the official UX.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  EyeOff,
  Square,
  MoreHorizontal,
  Mic,
  MicOff,
  Camera,
  StopCircle,
  Wifi,
  WifiOff,
  Volume2,
} from "lucide-react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useOverlayStore } from "../../lib/store";
import { useRouter } from "../../lib/router";
import { ChatStream } from "../../components/ChatStream";
import { InputBar } from "../../components/InputBar";
import { MicButton } from "../../components/MicButton";
import { VuMeter } from "../../components/VuMeter";
import { QuickActionChips, type QuickAction } from "../../components/QuickActionChips";
import { RecordingPill } from "../../components/RecordingPill";
import { HotkeyHintBar } from "../../components/HotkeyHintBar";
import { ScreenshotPreview } from "../../components/ScreenshotPreview";
import {
  onShortcutTriggered,
  hideOverlay,
  aiStartLive,
  aiStopLive,
  captureScreen,
  micStart,
  micStop,
  type CaptureMeta,
  type MicLevel,
} from "../../lib/tauri";
import { CardShell } from "../../components/ui";
import { cn } from "../../lib/utils";

type HeaderStatus = "ready" | "listening" | "thinking";
type LiveStatus = "idle" | "ready" | "reconnecting" | "error";


export function AssistantView() {
  const messages = useOverlayStore((s) => s.messages);
  const streaming = useOverlayStore((s) => s.streaming);
  const clearMessages = useOverlayStore((s) => s.clearMessages);
  const setStreaming = useOverlayStore((s) => s.setStreaming);
  const appendAssistantStreamChunk = useOverlayStore(
    (s) => s.appendAssistantStreamChunk,
  );
  const setView = useRouter((s) => s.setView);

  const [activeChip, setActiveChip] = useState<QuickAction>("assist");
  const [showMenu, setShowMenu] = useState(false);

  // ---- Phase 4: Live session state ----
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCapture, setLastCapture] = useState<CaptureMeta | null>(null);
  // ---- Microphone capture ----
  const [isMicRecording, setIsMicRecording] = useState(false);
  const [micLevel, setMicLevel] = useState<number>(-Infinity);
  const unlistenRef = useRef<UnlistenFn[]>([]);

  // Listen for the main assist hotkey to switch to Assist mode.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onShortcutTriggered((action) => {
      if (action === "next_step") {
        setActiveChip("assist");
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(console.error);
    return () => unlisten?.();
  }, []);

  // Subscribe to the Phase 4 event bus. All unlistens are collected and
  // torn down on unmount.
  useEffect(() => {
    const unlistens: UnlistenFn[] = [];
    unlistenRef.current = unlistens;

    const safe = (p: Promise<UnlistenFn>) =>
      p
        .then((fn) => unlistens.push(fn))
        .catch((err) => console.error("AssistantView listen failed:", err));

    // ai:status — payload is a free-form string. We bucket it into
    // idle/ready/reconnecting/error so the UI can color the dot.
    safe(
      listen<string>("ai:status", (e) => {
        const raw = e.payload ?? "";
        const lower = String(raw).toLowerCase();
        setStatusMessage(String(raw));
        if (lower.includes("reconnect") && lower.includes("fail")) {
          setLiveStatus("error");
        } else if (lower.includes("reconnect")) {
          setLiveStatus("reconnecting");
        } else if (lower.includes("ready") || lower === "closed") {
          // "closed" is the terminal shutdown state, treat as idle.
          setLiveStatus(lower === "closed" ? "idle" : "ready");
          if (lower === "closed") setSessionActive(false);
        } else if (lower.includes("error")) {
          setLiveStatus("error");
        } else if (lower) {
          // Any other status string — keep current bucket but surface text.
        }
      }),
    );

    // ai:transcript — incremental user/voice transcript from Gemini.
    safe(
      listen<string>("ai:transcript", (e) => {
        const chunk = e.payload ?? "";
        if (typeof chunk === "string" && chunk.length > 0) {
          setTranscript((prev) => (prev + chunk).slice(-4000));
        }
      }),
    );

    // ai:response:text — streamed response text chunks → main card.
    safe(
      listen<string>("ai:response:text", (e) => {
        const chunk = e.payload ?? "";
        if (typeof chunk === "string" && chunk.length > 0) {
          appendAssistantStreamChunk(chunk);
        }
      }),
    );

    // ai:response:audio — incoming model audio bytes (base64 in `data`).
    safe(
      listen<{ data?: string }>("ai:response:audio", () => {
        // We don't decode audio here; just flash the indicator for visual
        // feedback. The real playback happens in Rust/audio pipeline.
        setAudioPlaying(true);
        window.setTimeout(() => setAudioPlaying(false), 600);
      }),
    );

    // ai:turn:complete — the model finished speaking/responding.
    safe(
      listen("ai:turn:complete", () => {
        setStatusMessage("turn complete");
        setStreaming(false);
      }),
    );

    // capture:screen — server-initiated capture event. We track the last
    // one for the manual-button thumbnail; ScreenshotPreview already
    // renders a larger card.
    safe(
      listen<CaptureMeta>("capture:screen", (e) => {
        if (e.payload) {
          setLastCapture({
            ...e.payload,
            // Rust serializes `created_at` (snake_case); normalize to camelCase.
            createdAt:
              (e.payload as unknown as { created_at?: number }).created_at ??
              e.payload.createdAt,
          });
        }
      }),
    );

    // mic:level — RMS audio level in dBFS from the Rust audio pipeline.
    // Forwarded into the VuMeter. -Infinity is a valid sentinel for "silence".
    safe(
      listen<MicLevel>("mic:level", (e) => {
        const v = e.payload?.rmsDb;
        if (typeof v === "number") setMicLevel(v);
      }),
    );

    // mic:error — surface capture failures (permission denied, device
    // busy, etc.) into the existing error banner and clear the recording
    // state so the button doesn't appear stuck on.
    safe(
      listen<{ message?: string }>("mic:error", (e) => {
        const message =
          e.payload?.message ?? "microphone error (no message)";
        setError(`mic: ${message}`);
        setIsMicRecording(false);
      }),
    );

    return () => {
      for (const fn of unlistens) {
        try {
          fn();
        } catch (err) {
          console.error("AssistantView unlisten failed:", err);
        }
      }
      unlistenRef.current = [];
    };
  }, [appendAssistantStreamChunk, setStreaming]);

  // ---- Phase 4: Action handlers ----

  const onStartSession = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      // Placeholder API key from settings — the Rust layer will pick the
      // real key from app config when available. This just proves the
      // command wires up.
      const apiKey = "demo-key-replace-in-settings";
      const systemInstruction =
        "You are a concise, helpful stealth assistant. Keep answers short and ready to speak.";
      await aiStartLive(apiKey, systemInstruction);
      setSessionActive(true);
      setLiveStatus("reconnecting"); // backend hasn't confirmed yet; this flips to "ready" on ai:status
      setTranscript("");
      setStreaming(false);
    } catch (err) {
      console.error("aiStartLive failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setLiveStatus("error");
    } finally {
      setBusy(false);
    }
  }, []);

  const onStopSession = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      // Ensure the mic is released whenever the live session ends.
      if (isMicRecording) {
        try {
          await micStop();
        } catch (err) {
          console.error("micStop on session-stop failed:", err);
        }
        setIsMicRecording(false);
        setMicLevel(-Infinity);
      }
      await aiStopLive();
      setSessionActive(false);
      setLiveStatus("idle");
      setStatusMessage("stopped");
    } catch (err) {
      console.error("aiStopLive failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [isMicRecording]);

  const onCapture = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const meta = await captureScreen();
      setLastCapture(meta);
    } catch (err) {
      console.error("captureScreen failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const onStartMic = useCallback(async () => {
    setError(null);
    try {
      await micStart();
      setIsMicRecording(true);
      setMicLevel(-Infinity);
    } catch (err) {
      console.error("micStart failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setIsMicRecording(false);
    }
  }, []);

  const onStopMic = useCallback(async () => {
    setError(null);
    try {
      await micStop();
    } catch (err) {
      console.error("micStop failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsMicRecording(false);
      setMicLevel(-Infinity);
    }
  }, []);

  const status: HeaderStatus = streaming
    ? "thinking"
    : sessionActive
      ? "listening"
      : messages.length === 0
        ? "ready"
        : "listening";

  const stopEverything = () => {
    clearMessages();
    setActiveChip("assist");
  };

  return (
    <div className="h-full w-full flex items-start justify-center p-4 bg-transparent">
      <CardShell className="max-h-[85vh]">
        {/* Header — draggable, no-drag buttons */}
        <header
          className="relative flex items-center justify-between px-3 py-3 border-b border-white/[0.06] shrink-0 select-none"
          data-tauri-drag-region
        >
          {/* Logo pill */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center">
              <span className="text-zinc-900 text-[10px] font-bold">C</span>
            </div>
            <span className="text-[11px] font-semibold text-zinc-200 tracking-tight">
              Cluely
            </span>
          </div>

          {/* Status pill, absolutely centered */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 text-[11px] font-medium text-zinc-200 border border-zinc-700/60">
              <StatusDot status={status} />
              {status === "ready" && "Ready"}
              {status === "listening" && "Listening live"}
              {status === "thinking" && "Thinking…"}
            </span>
            <RecordingPill
              active={isMicRecording || status === "listening"}
              label={isMicRecording ? "Mic" : activeChip === "recap" ? "Recording" : "Live"}
            />
            <VuMeter level={micLevel} />
            <LiveStatusBadge status={liveStatus} message={statusMessage} />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1" data-tauri-no-drag>
            <button
              onClick={stopEverything}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
              title="Stop and clear"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
            <button
              onClick={() => hideOverlay().catch(console.error)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              title="Hide overlay"
            >
              <EyeOff className="w-3.5 h-3.5" />
              Hide
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMenu((s) => !s)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                aria-label="More options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showMenu && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-36 rounded-xl border border-zinc-700/60 bg-zinc-900/95 backdrop-blur-xl shadow-xl py-1 z-50"
                  onMouseLeave={() => setShowMenu(false)}
                >
                  {[
                    ["settings", "Settings"],
                    ["history", "History"],
                    ["help", "Help"],
                  ].map(([view, label]) => (
                    <button
                      key={view}
                      onClick={() => {
                        setShowMenu(false);
                        setView(view as "settings" | "history" | "help");
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mode prompt pill */}
        <div className="px-4 pt-4 pb-1 shrink-0">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/60 border border-zinc-700/60">
            <span className="text-[11px] font-medium text-zinc-200">
              {activeChip === "assist" && "Assist"}
              {activeChip === "say" && "What should I say?"}
              {activeChip === "followup" && "Follow-up questions"}
              {activeChip === "recap" && "Recap"}
            </span>
          </div>
        </div>

        {/* Response area */}
        <div className="flex-1 min-h-0 px-4">
          <ChatStream mode={activeChip} />
        </div>

        {/* Screenshot preview (server-pushed) */}
        <ScreenshotPreview />

        {/* Quick action chips */}
        <div className="px-4 py-3 shrink-0">
          <QuickActionChips active={activeChip} onSelect={setActiveChip} />
        </div>

        {/* Phase 4: Live session controls */}
        <div className="px-4 pb-3 shrink-0">
          <div
            className={cn(
              "rounded-xl border border-white/[0.08] bg-zinc-900/60 backdrop-blur-xl p-3 space-y-2.5",
            )}
            role="group"
            aria-label="Gemini Live session controls"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {sessionActive ? (
                  <Mic className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                ) : (
                  <MicOff className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                )}
                <span className="text-[11px] font-semibold text-zinc-200 truncate">
                  Gemini Live
                </span>
                {audioPlaying && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-blue-300">
                    <Volume2 className="w-3 h-3 animate-pulse" />
                    playing
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!sessionActive ? (
                  <button
                    onClick={onStartSession}
                    disabled={busy}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    Start session
                  </button>
                ) : (
                  <button
                    onClick={onStopSession}
                    disabled={busy}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    Stop session
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={onCapture}
                disabled={busy}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 transition-colors disabled:opacity-50"
                title="Capture the primary display"
              >
                <Camera className="w-3.5 h-3.5" />
                Take screenshot
              </button>
              <MicButton
                isRecording={isMicRecording}
                onStart={onStartMic}
                onStop={onStopMic}
                disabled={!sessionActive || busy}
                title={
                  !sessionActive
                    ? "Start a Gemini Live session first"
                    : isMicRecording
                      ? "Stop microphone"
                      : "Start microphone"
                }
              />
              {lastCapture && (
                <span className="text-[10px] text-zinc-500 tabular-nums">
                  last capture: {lastCapture.width}×{lastCapture.height}
                </span>
              )}
            </div>

            {error && (
              <div
                className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300"
                role="alert"
              >
                {error}
              </div>
            )}

            {transcript && (
              <div className="rounded-md border border-white/[0.06] bg-zinc-950/60 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-0.5">
                  Transcript
                </div>
                <p className="text-[11.5px] text-zinc-200 whitespace-pre-wrap break-words leading-relaxed">
                  {transcript}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Input bar */}
        <div className="p-3 border-t border-white/[0.06] shrink-0">
          <InputBar mode={activeChip} />
        </div>

        {/* Hotkey hint bar — Cluely-style keycap row */}
        <HotkeyHintBar
          hints={[
            { label: "Hide", keys: ["Cmd", "\\"] },
            { label: "Next step", keys: ["Cmd", "Enter"] },
          ]}
        />
      </CardShell>
    </div>
  );
}

function StatusDot({ status }: { status: HeaderStatus }) {
  const color =
    status === "ready"
      ? "bg-emerald-400"
      : status === "listening"
        ? "bg-blue-400"
        : "bg-amber-400 animate-pulse";
  return <span className={cn("w-1.5 h-1.5 rounded-full", color)} />;
}

function LiveStatusBadge({
  status,
  message,
}: {
  status: LiveStatus;
  message: string;
}) {
  if (status === "idle") return null;

  const palette =
    status === "ready"
      ? { dot: "bg-emerald-400", text: "text-emerald-300", Icon: Wifi }
      : status === "reconnecting"
        ? { dot: "bg-amber-400 animate-pulse", text: "text-amber-300", Icon: Wifi }
        : { dot: "bg-red-400", text: "text-red-300", Icon: WifiOff };

  const label =
    status === "ready"
      ? "live ready"
      : status === "reconnecting"
        ? "reconnecting"
        : "live error";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] font-medium border border-zinc-700/60",
        palette.text,
      )}
      title={message || label}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", palette.dot)} />
      <palette.Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
