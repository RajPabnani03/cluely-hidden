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
  MoreHorizontal,
} from "lucide-react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useOverlayStore } from "../../lib/store";
import { useRouter } from "../../lib/router";
import { ChatStream } from "../../components/ChatStream";
import { InputBar } from "../../components/InputBar";
import { QuickActionChips, type QuickAction } from "../../components/QuickActionChips";
import { RecordingPill } from "../../components/RecordingPill";
import { HotkeyHintBar } from "../../components/HotkeyHintBar";
import { ScreenshotPreview } from "../../components/ScreenshotPreview";
import { persistLiveSessionToHistory } from "../../lib/session-persist";
import {
  onShortcutTriggered,
  hideOverlay,
  aiStartLiveConfigured,
  aiStopLive,
  captureScreen,
  micStart,
  micStop,
  dualBrainStep,
  onSpeakable,
  createConversation,
  getSettings,
  saveMessage,
  setOverlayLayout,
  updateSettings,
  type CaptureMeta,
  type MicLevel,
} from "../../lib/tauri";
import { CompactPill } from "../../components/CompactPill";
import { ScreenshotTray } from "../../components/ScreenshotTray";
import { TeleprompterStrip } from "../../components/TeleprompterStrip";
import { CluelyLogo } from "../../components/CluelyLogo";
import { SessionToolbar } from "../../components/SessionToolbar";
import { CardShell } from "../../components/ui";
import { cn } from "../../lib/utils";

type HeaderStatus = "ready" | "listening" | "thinking";
type LiveStatus = "idle" | "ready" | "reconnecting" | "error";


export function AssistantView() {
  const messages = useOverlayStore((s) => s.messages);
  const streaming = useOverlayStore((s) => s.streaming);
  const currentConversationId = useOverlayStore((s) => s.currentConversationId);
  const setConversationId = useOverlayStore((s) => s.setConversationId);
  const clearMessages = useOverlayStore((s) => s.clearMessages);
  const setStreaming = useOverlayStore((s) => s.setStreaming);
  const appendAssistantStreamChunk = useOverlayStore(
    (s) => s.appendAssistantStreamChunk,
  );
  const overlayLayout = useOverlayStore((s) => s.overlayLayout);
  const overlayOpacity = useOverlayStore((s) => s.overlayOpacity);
  const stealthTier = useOverlayStore((s) => s.stealthTier);
  const clickThrough = useOverlayStore((s) => s.clickThrough);
  const hotkeyBindings = useOverlayStore((s) => s.hotkeyBindings);
  const screenshotTray = useOverlayStore((s) => s.screenshotTray);
  const addScreenshotToTray = useOverlayStore((s) => s.addScreenshotToTray);
  const removeScreenshotFromTray = useOverlayStore(
    (s) => s.removeScreenshotFromTray,
  );
  const clearScreenshotTray = useOverlayStore((s) => s.clearScreenshotTray);
  const pushResponseSnapshot = useOverlayStore((s) => s.pushResponseSnapshot);
  const setResponseIndex = useOverlayStore((s) => s.setResponseIndex);
  const responseSnapshots = useOverlayStore((s) => s.responseSnapshots);
  const responseIndex = useOverlayStore((s) => s.responseIndex);
  const speakableText = useOverlayStore((s) => s.speakableText);
  const setSpeakableText = useOverlayStore((s) => s.setSpeakableText);
  const appendMessage = useOverlayStore((s) => s.appendMessage);
  const updateLastMessage = useOverlayStore((s) => s.updateLastMessage);
  const setView = useRouter((s) => s.setView);

  const [activeChip, setActiveChip] = useState<QuickAction>("assist");
  const [showMenu, setShowMenu] = useState(false);
  const [showSessionDetails, setShowSessionDetails] = useState(false);

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
  const [, setMicLevel] = useState<number>(-Infinity);
  const [vadMode, setVadMode] = useState<"aggressive" | "balanced" | "manual">(
    "balanced",
  );
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const unlistenRef = useRef<UnlistenFn[]>([]);
  const sessionActiveRef = useRef(false);
  const onCaptureRef = useRef<(() => Promise<void>) | null>(null);
  const onStartSessionRef = useRef<(() => Promise<void>) | null>(null);
  sessionActiveRef.current = sessionActive;

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
        const last = useOverlayStore
          .getState()
          .messages.filter((m) => m.role === "assistant")
          .pop();
        if (last?.content) pushResponseSnapshot(last.content);
      }),
    );

    // capture:screen — server-initiated capture event. We track the last
    // one for the manual-button thumbnail; ScreenshotPreview already
    // renders a larger card.
    safe(
      listen<CaptureMeta>("capture:screen", (e) => {
        if (e.payload) {
          const meta = {
            ...e.payload,
            createdAt:
              (e.payload as unknown as { created_at?: number }).created_at ??
              e.payload.createdAt,
          };
          setLastCapture(meta);
          addScreenshotToTray(meta);
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

    safe(onSpeakable((text) => setSpeakableText(text)));

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
  }, [appendAssistantStreamChunk, setStreaming, pushResponseSnapshot, addScreenshotToTray, setSpeakableText]);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setVadMode(s.vadMode ?? "balanced");
        setActiveProfileId(s.activeProfileId ?? null);
      })
      .catch(console.error);
  }, []);

  // ---- Phase 4: Action handlers ----

  const onStartSession = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const settings = await getSettings();
      setActiveProfileId(settings.activeProfileId ?? null);
      const conv = await createConversation(settings.activeProfileId ?? null);
      setConversationId(conv.id);
      await aiStartLiveConfigured(conv.id);
      setSessionActive(true);
      setLiveStatus("reconnecting");
      setTranscript("");
      clearMessages();
      setStreaming(false);
    } catch (err) {
      console.error("aiStartLive failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setLiveStatus("error");
    } finally {
      setBusy(false);
    }
  }, [clearMessages, setConversationId, setStreaming]);

  const onStopSession = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
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
      const settings = await getSettings();
      const savedId = await persistLiveSessionToHistory({
        conversationId: currentConversationId,
        messages,
        transcript,
        profileId: settings.activeProfileId ?? null,
      });
      if (savedId) setConversationId(savedId);
      setSessionActive(false);
      setLiveStatus("idle");
      setStatusMessage("stopped");
    } catch (err) {
      console.error("aiStopLive failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [
    currentConversationId,
    isMicRecording,
    messages,
    setConversationId,
    transcript,
  ]);

  const onCapture = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const meta = await captureScreen();
      setLastCapture(meta);
      addScreenshotToTray(meta);
    } catch (err) {
      console.error("captureScreen failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [addScreenshotToTray]);

  const onDualBrainStep = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const tray = useOverlayStore.getState().screenshotTray;
      const trayNote =
        tray.length > 0
          ? tray
              .map((m) => `- screenshot ${m.width}×${m.height} (${m.id})`)
              .join("\n")
          : "(screenshot tray empty — dual-brain will capture fresh screen)";
      const result = await dualBrainStep({
        liveTranscript: transcript,
        extraContext: trayNote,
        profileId: activeProfileId,
      });
      setSpeakableText(result.speakable);
      pushResponseSnapshot(result.speakable);
      appendMessage({
        id: `dual-${Date.now()}`,
        role: "assistant",
        content: result.speakable,
        createdAt: Date.now(),
      });
      addScreenshotToTray(result.capture);
      setLastCapture(result.capture);
      const convId = useOverlayStore.getState().currentConversationId;
      if (convId && result.speakable.trim()) {
        try {
          await saveMessage({
            conversationId: convId,
            role: "assistant",
            content: result.speakable.trim(),
            model: "dual-brain",
          });
        } catch (e) {
          console.warn("saveMessage (dual-brain) failed:", e);
        }
      }
    } catch (err) {
      console.error("dualBrainStep failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [
    activeProfileId,
    addScreenshotToTray,
    appendMessage,
    pushResponseSnapshot,
    setSpeakableText,
    transcript,
  ]);

  const onDualBrainRef = useRef<(() => Promise<void>) | null>(null);
  onCaptureRef.current = onCapture;
  onStartSessionRef.current = onStartSession;
  onDualBrainRef.current = onDualBrainStep;

  const applyCarouselIndex = useCallback(
    (next: number) => {
      setResponseIndex(next);
      const text = responseSnapshots[next];
      if (!text) return;
      setSpeakableText(text);
      const msgs = useOverlayStore.getState().messages;
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant") {
        updateLastMessage(text);
      } else {
        appendMessage({
          id: `carousel-${next}-${Date.now()}`,
          role: "assistant",
          content: text,
          createdAt: Date.now(),
        });
      }
    },
    [
      appendMessage,
      responseSnapshots,
      setResponseIndex,
      setSpeakableText,
      updateLastMessage,
    ],
  );

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onShortcutTriggered((action) => {
      if (action === "next_step") {
        setActiveChip("assist");
        if (sessionActiveRef.current) {
          void onDualBrainRef.current?.();
        } else {
          void onStartSessionRef.current?.();
        }
        return;
      }
      const scrollEl = document.getElementById("assistant-scroll-region");
      if (action === "scroll_up") {
        scrollEl?.scrollBy({ top: -96, behavior: "smooth" });
        return;
      }
      if (action === "scroll_down") {
        scrollEl?.scrollBy({ top: 96, behavior: "smooth" });
        return;
      }
      if (action === "previous_response" && responseSnapshots.length > 0) {
        applyCarouselIndex(Math.max(0, responseIndex - 1));
        return;
      }
      if (action === "next_response" && responseSnapshots.length > 0) {
        applyCarouselIndex(
          Math.min(responseSnapshots.length - 1, responseIndex + 1),
        );
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(console.error);
    return () => unlisten?.();
  }, [
    applyCarouselIndex,
    responseIndex,
    responseSnapshots.length,
  ]);

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

  const lastAssistant =
    messages.filter((m) => m.role === "assistant").pop()?.content ?? "";

  const expandFromCompact = useCallback(async () => {
    useOverlayStore.getState().setOverlayLayout("full");
    await updateSettings({ overlayLayout: "full" });
    await setOverlayLayout("full");
  }, []);

  const hintFor = (action: string, label: string) => {
    const row = hotkeyBindings.find(([a]) => a === action);
    if (!row) return { label, keys: ["?"] };
    const keys = row[1].split("+").map((k) =>
      k === "CmdOrCtrl" ? "Cmd" : k.replace(/^Arrow/, ""),
    );
    return { label, keys };
  };

  if (overlayLayout === "compact") {
    return (
      <CompactPill
        opacity={overlayOpacity}
        stealthTier={stealthTier}
        sessionActive={sessionActive}
        statusLabel={
          status === "thinking"
            ? "Thinking"
            : sessionActive
              ? "Live"
              : "Ready"
        }
        preview={lastAssistant}
        onExpand={() => void expandFromCompact()}
        onOpenSettings={() => setView("settings")}
      />
    );
  }

  return (
    <div className="h-full w-full flex items-start justify-center p-3 sm:p-4 bg-transparent animate-fade-in">
      <CardShell className="max-h-[88vh]" opacity={overlayOpacity}>
        <header
          className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/[0.06] shrink-0 select-none"
          data-tauri-drag-region
        >
          <CluelyLogo />
          <div className="flex items-center gap-2 min-w-0" data-tauri-no-drag>
            {sessionActive && (
              <RecordingPill
                active
                label={status === "thinking" ? "Thinking" : "Recording"}
              />
            )}
            {!sessionActive && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/80 border border-white/[0.08] text-[10px] text-zinc-400">
                <StatusDot status={status} />
                {liveStatus === "error" ? "Check connection" : "Undetectable"}
              </span>
            )}
            {clickThrough && (
              <span className="text-[9px] text-amber-400/90 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
                pass-through
              </span>
            )}
            <button
              type="button"
              onClick={() => hideOverlay().catch(console.error)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/50"
              title="Hide overlay"
            >
              <EyeOff className="w-3.5 h-3.5" />
              Hide
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu((s) => !s)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/50"
                aria-label="More options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showMenu && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-40 rounded-2xl border border-white/[0.08] bg-zinc-900/95 backdrop-blur-xl shadow-xl py-1 z-50"
                  onMouseLeave={() => setShowMenu(false)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      void stopEverything();
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-red-300/90 hover:bg-red-500/10"
                  >
                    Stop & clear
                  </button>
                  {[
                    ["settings", "Settings"],
                    ["history", "History"],
                    ["help", "Help"],
                  ].map(([view, label]) => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        setView(view as "settings" | "history" | "help");
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="px-4 pt-3 pb-1 shrink-0">
          <QuickActionChips active={activeChip} onSelect={setActiveChip} />
        </div>

        <ScreenshotPreview />

        <div className="flex-1 min-h-0 px-4 flex flex-col gap-2 overflow-hidden">
          {speakableText ? (
            <TeleprompterStrip text={speakableText} className="shrink-0" />
          ) : null}
          {responseSnapshots.length > 1 && (
            <div className="shrink-0 flex items-center justify-between text-[10px] text-zinc-500 tabular-nums">
              <span>
                Response {responseIndex + 1} / {responseSnapshots.length}
              </span>
              <span className="text-zinc-600">⌘← · ⌘→</span>
            </div>
          )}
          <ChatStream
            mode={activeChip}
            hideWhenSpeakable
            speakableText={speakableText}
          />
        </div>

        {screenshotTray.length > 0 && (
          <div className="px-4 shrink-0">
            <ScreenshotTray
              items={screenshotTray}
              onRemove={removeScreenshotFromTray}
              onClear={clearScreenshotTray}
            />
          </div>
        )}

        <div className="px-4 py-3 shrink-0 border-t border-white/[0.04]">
          <SessionToolbar
            sessionActive={sessionActive}
            busy={busy}
            isMicRecording={isMicRecording}
            audioPlaying={audioPlaying}
            vadMode={vadMode}
            onStartSession={onStartSession}
            onStopSession={onStopSession}
            onCapture={onCapture}
            onStartMic={onStartMic}
            onStopMic={onStopMic}
            transcript={transcript}
            error={error}
            expandedDetails={showSessionDetails}
            onToggleDetails={() => setShowSessionDetails((v) => !v)}
            captureHint={
              lastCapture
                ? `${lastCapture.width}×${lastCapture.height}`
                : null
            }
          />
          {liveStatus === "reconnecting" && (
            <p className="text-[10px] text-amber-400/90 mt-1.5 px-1">
              Reconnecting… {statusMessage}
            </p>
          )}
        </div>

        <div className="px-4 pb-3 shrink-0">
          <InputBar mode={activeChip} />
        </div>

        <HotkeyHintBar
          hints={[
            hintFor("toggle_visibility", "Hide"),
            hintFor("next_step", "Assist"),
            hintFor("previous_response", "Prev"),
            hintFor("next_response", "Next"),
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
