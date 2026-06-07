import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

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
}

export async function getSettings(): Promise<AppSettings> {
  return invoke("get_settings");
}

export async function updateSettings(
  patch: Partial<AppSettings>,
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

export async function chat(input: {
  conversationId: string | null;
  message: string;
}): Promise<ChatMessage> {
  return invoke("chat", { input });
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
