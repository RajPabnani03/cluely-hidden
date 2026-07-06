import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  DbProfile,
  DbConversation,
  DbMessage,
} from "./db-types";

export type {
  DbProfile,
  DbConversation,
  DbMessage,
  DbCapture,
} from "./db-types";

/**
 * Typed Tauri IPC API. Mirrors the Rust commands in src-tauri/src/.
 *
 * As we add commands in each phase, we add their TypeScript wrappers here.
 * Frontend code should ONLY call these typed wrappers, never raw `invoke`.
 */

// ---------- Window ----------
export async function toggleOverlay(): Promise<void> {
  return invoke("toggle_overlay");
}

export async function showOverlay(): Promise<void> {
  return invoke("show_overlay");
}

export async function hideOverlay(): Promise<void> {
  return invoke("hide_overlay");
}

export async function setClickThrough(enabled: boolean): Promise<void> {
  return invoke("set_click_through", { enabled });
}

export async function openSettings(): Promise<void> {
  return invoke("open_settings");
}

export async function quitApp(): Promise<void> {
  return invoke("quit_app");
}

// ---------- Settings ----------
export interface AppSettings {
  hotkey: string;
  theme: "light" | "dark" | "system";
  model: string;
  captureEnabled: boolean;
  audioEnabled: boolean;
  launchAtLogin: boolean;
  /** True when a Gemini key exists in Keychain (raw key never returned). */
  geminiApiKeyConfigured: boolean;
  activeProfileId?: string | null;
  /** Overlay panel opacity 0.4–1.0 */
  overlayOpacity: number;
}

/** Patch for update_settings — include geminiApiKey only when setting/changing the key. */
export type SettingsUpdatePatch = Partial<
  Omit<AppSettings, "geminiApiKeyConfigured">
> & {
  geminiApiKey?: string;
};

export async function getSettings(): Promise<AppSettings> {
  return invoke("get_settings");
}

export async function updateSettings(
  patch: SettingsUpdatePatch,
): Promise<AppSettings> {
  return invoke("update_settings", { patch });
}

// ---------- Chat (stub in v0.1, real in v0.2) ----------
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
}

function generateMsgId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function realisticPlaceholderResponse(message: string): string {
  const lower = message.toLowerCase();
  let suggestion =
    "I don't have a live AI provider configured right now, but once you add an API key in Settings I'll give you concise, ready-to-speak answers here.";

  if (lower.includes("interview") || lower.includes("tell me about yourself")) {
    suggestion =
      "I'm a software engineer with 5 years of experience building scalable web apps. I specialize in React and Node.js, and I've led small teams through two product launches.";
  } else if (lower.includes("sales") || lower.includes("price")) {
    suggestion =
      "Our platform typically saves customers 30% on operational costs within the first 90 days. Happy to walk through the ROI for your specific workflow.";
  } else if (lower.includes("meeting") || lower.includes("status")) {
    suggestion =
      "We're on track to hit the deadline. 75% of deliverables are complete, and the remaining work is scheduled for Friday. The main open item is integration testing.";
  } else if (lower.includes("negotiation") || lower.includes("deal")) {
    suggestion =
      "I understand budget is a key concern. Our current offer already includes a 15% discount, and we can structure payments over 12 months if that helps.";
  } else if (lower.includes("presentation") || lower.includes("pitch")) {
    suggestion =
      "Our three-year growth trajectory speaks for itself: 150% year-over-year revenue growth, 99.9% uptime, and customer acquisition costs that have stayed flat.";
  } else if (lower.includes("exam") || lower.includes("question")) {
    suggestion =
      "The capital of France is **Paris** — it's been the political and cultural center of the country since 987 CE.";
  } else if (lower.includes("hello") || lower.includes("hi ")) {
    suggestion =
      "Hey! I'm your stealth assistant. Ask me anything and I'll keep the answers short and ready to speak.";
  }

  return `**Demo mode — realistic placeholder reply:**\n\n${suggestion}\n\n_(Configure an API key in Settings to get live answers.)_`;
}

function isApiConfigured(settings: AppSettings | null): boolean {
  if (!settings) return false;
  return settings.geminiApiKeyConfigured;
}

export async function chat(input: {
  conversationId: string | null;
  message: string;
}): Promise<ChatMessage> {
  let settings: AppSettings | null = null;
  try {
    settings = await getSettings();
  } catch {
    // If we can't read settings, treat API as unconfigured.
  }

  if (!isApiConfigured(settings)) {
    // Temporary demo path so users always see UI activity.
    await new Promise((resolve) => setTimeout(resolve, 700));
    return {
      id: input.conversationId ?? `demo-${generateMsgId()}`,
      role: "assistant",
      content: realisticPlaceholderResponse(input.message),
      createdAt: Date.now(),
    };
  }

  try {
    return await invoke<ChatMessage>("chat", { input });
  } catch (err) {
    // Graceful fallback: don't leave the UI hanging.
    console.error("chat invoke failed:", err);
    return {
      id: input.conversationId ?? `demo-${generateMsgId()}`,
      role: "assistant",
      content: realisticPlaceholderResponse(input.message),
      createdAt: Date.now(),
    };
  }
}

// ---------- Hotkeys ----------
export type HotkeyActionId =
  | "toggle_visibility"
  | "next_step"
  | "emergency_erase"
  | "toggle_click_through"
  | "move_up"
  | "move_down"
  | "move_left"
  | "move_right"
  | "previous_response"
  | "next_response"
  | "scroll_up"
  | "scroll_down";

export type HotkeyBinding = [HotkeyActionId, string];
export type HotkeyBindings = HotkeyBinding[];

export async function getHotkeyBindings(): Promise<HotkeyBindings> {
  return invoke("get_hotkey_bindings");
}

export async function rebindHotkey(
  action: HotkeyActionId,
  newKey: string,
): Promise<void> {
  return invoke("rebind_hotkey", { action, newKey });
}

export async function onShortcutTriggered(
  cb: (action: HotkeyActionId) => void,
): Promise<UnlistenFn> {
  return listen<string>("shortcut:triggered", (e) => cb(e.payload as HotkeyActionId));
}

export async function onClearSensitiveData(cb: () => void): Promise<UnlistenFn> {
  return listen("clear-sensitive-data", () => cb());
}

// ---------- Event subscriptions ----------
export function onOverlayVisibilityChange(
  cb: (visible: boolean) => void,
): Promise<UnlistenFn> {
  return listen<boolean>("overlay:visibility", (e) => cb(e.payload));
}

// ---------- Phase 7 (Ollama) — added later ----------
// export async function* streamChat(...): AsyncIterable<string> { ... }

// ---------- DB: Profiles ----------
export async function listProfiles(): Promise<DbProfile[]> {
  return invoke("list_profiles");
}

export async function getProfile(id: string): Promise<DbProfile | null> {
  return invoke("get_profile", { id });
}

export async function createProfile(
  name: string,
  systemPrompt: string,
): Promise<DbProfile> {
  return invoke("create_profile", { name, systemPrompt });
}

export async function updateProfile(
  id: string,
  name: string | undefined,
  systemPrompt: string | undefined,
): Promise<DbProfile> {
  return invoke("update_profile", { id, name, systemPrompt });
}

export async function deleteProfile(id: string): Promise<void> {
  return invoke("delete_profile", { id });
}

// ---------- DB: Conversations ----------
export async function listConversations(): Promise<DbConversation[]> {
  return invoke("list_conversations");
}

export async function createConversation(
  profileId: string | null,
): Promise<DbConversation> {
  return invoke("create_conversation", { profileId });
}

export async function updateConversationTitle(
  id: string,
  title: string,
): Promise<void> {
  return invoke("update_conversation_title", { id, title });
}

export async function deleteConversation(id: string): Promise<void> {
  return invoke("delete_conversation", { id });
}

// ---------- DB: Messages ----------
export async function listMessages(
  conversationId: string,
): Promise<DbMessage[]> {
  return invoke("list_messages", { conversationId });
}

export async function saveMessage(args: {
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  audioTranscript?: string;
  screenshotId?: string;
  model?: string;
}): Promise<DbMessage> {
  return invoke("save_message", args);
}

// ---------- DB: Captures (typed for Phase 4 — no wrapper yet) ----------
// export async function listCaptures(): Promise<DbCapture[]> { ... }

// ---------- HistoryView helpers (Phase 3D) ----------
//
// Convenience wrappers used by HistoryView. The underlying commands
// (`list_conversations`, `delete_conversation`, `list_messages`,
// `get_profile`) all live in src-tauri/src/ipc/commands.rs and are
// already exposed above as `listConversations`, `deleteConversation`,
// `listMessages`, and `getProfile`.
//
// `searchConversations` is the one new entry point. It is implemented as
// a client-side filter over `listConversations` + per-row `listMessages`.
// There is intentionally no Rust `search_conversations` command yet —
// SQLite FTS5 can be added later in Phase 4+ without changing call sites.

/**
 * Find conversations whose title OR message content matches `query`.
 * Case-insensitive substring match. Empty query returns everything.
 */
export async function searchConversations(
  query: string,
): Promise<DbConversation[]> {
  const trimmed = query.trim();
  if (!trimmed) return listConversations();
  const q = trimmed.toLowerCase();
  const conversations = await listConversations();
  const matches: DbConversation[] = [];
  for (const c of conversations) {
    if ((c.title ?? "").toLowerCase().includes(q)) {
      matches.push(c);
      continue;
    }
    try {
      const msgs = await listMessages(c.id);
      if (msgs.some((m) => (m.content ?? "").toLowerCase().includes(q))) {
        matches.push(c);
      }
    } catch {
      // Skip conversations whose messages cannot be loaded.
    }
  }
  return matches;
}

// Shape aliases — keep view code readable. These match the Db* types exactly.
export type Conversation = DbConversation;
export type Message = DbMessage;
export type Profile = DbProfile;

// ---------- Phase 4: Gemini Live + screen capture IPC ----------
//
// These wrappers call commands added in src-tauri/src/ipc/commands.rs
// (commit 806b31a). They are intentionally minimal — typed envelopes
// only, no extra logic. The frontend (`AssistantView`) handles event
// subscription and UI state.

/** Metadata describing a single screen capture, returned by `captureScreen`. */
export interface CaptureMeta {
  id: string;
  /** Absolute path to the PNG on disk (Rust `PathBuf` → string). */
  path: string;
  width: number;
  height: number;
  /** Unix epoch (ms) when the capture was written. */
  createdAt: number;
}

/** Open a Gemini Live WebSocket session (explicit key + instruction). */
export async function aiStartLive(
  apiKey: string,
  systemInstruction: string,
): Promise<void> {
  return invoke("ai_start_live", { apiKey, systemInstruction });
}

/** Open Gemini Live using Settings API key + active profile system prompt. */
export async function aiStartLiveConfigured(
  profileId?: string | null,
): Promise<void> {
  return invoke("ai_start_live_configured", { profileId: profileId ?? null });
}

/** Stream a chunk of 16 kHz mono PCM audio to the live session. */
export async function aiSendAudio(pcmBase64: string): Promise<void> {
  return invoke("ai_send_audio", { pcmBase64 });
}

/** Close the active Gemini Live session, if any. */
export async function aiStopLive(): Promise<void> {
  return invoke("ai_stop_live");
}

/** Capture the primary display and return its metadata. */
export async function captureScreen(): Promise<CaptureMeta> {
  return invoke<CaptureMeta>("capture_screen");
}

// ---------- Microphone capture (Rust lane in flight) ----------
//
// The Rust Lead subagent is shipping these commands in parallel:
//
//   mic_start() -> Result<(), String>
//   mic_stop()  -> Result<(), String>
//   event "mic:level"  -> { rmsDb: number }   (RMS in dBFS, ~ -60..0)
//   event "mic:error"  -> { message: string } (human-readable failure)
//
// The TypeScript wrappers compile even if Rust hasn't shipped yet —
// `invoke` is a free-form string-keyed bridge. At runtime a missing
// command surfaces as a rejection that AssistantView already catches
// and renders in the existing `error` banner.

/** Payload of the `mic:level` event — current RMS in dBFS. */
export interface MicLevel {
  rmsDb: number;
}

/** Begin microphone capture in the Rust audio pipeline. */
export async function micStart(): Promise<void> {
  return invoke("mic_start");
}

/** Stop microphone capture and release the OS audio device. */
export async function micStop(): Promise<void> {
  return invoke("mic_stop");
}
