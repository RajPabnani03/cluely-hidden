/**
 * In-browser simulation of the Rust side of the app.
 *
 * Only loaded when Vite aliases `@tauri-apps/api/*` here (dev:browser mode).
 * Implements every IPC command the frontend calls plus the event channels
 * it subscribes to, so the full overlay UX can be exercised without macOS.
 *
 * Not intended for production — `vite build` never resolves these modules.
 */

type Handler = (payload: unknown) => void;

const listeners = new Map<string, Set<Handler>>();

export function emitLocal(event: string, payload: unknown): void {
  const set = listeners.get(event);
  if (!set) return;
  for (const h of set) {
    try {
      h(payload);
    } catch (err) {
      console.error(`[mock] listener for ${event} failed:`, err);
    }
  }
}

export function addListener(event: string, handler: Handler): () => void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(handler);
  // Mirror Rust behaviour: the overlay is shown by the OS on launch, so any
  // new visibility subscriber immediately learns the current state.
  if (event === "overlay:visibility") {
    setTimeout(() => handler(state.visible), 0);
  }
  return () => {
    set.delete(handler);
  };
}

// ---------------- state ----------------

interface MockSettings {
  hotkey: string;
  theme: "light" | "dark" | "system";
  model: string;
  captureEnabled: boolean;
  audioEnabled: boolean;
  launchAtLogin: boolean;
  geminiApiKeyConfigured: boolean;
  activeProfileId: string | null;
  overlayOpacity: number;
  overlayLayout: "full" | "compact";
  stealthTier: string;
  aiProvider: "gemini" | "groq";
  vadMode: "aggressive" | "balanced" | "manual";
}

const settings: MockSettings = {
  hotkey: "CmdOrCtrl+Backslash",
  theme: "dark",
  model: "gemini-2.5-flash",
  captureEnabled: true,
  audioEnabled: true,
  launchAtLogin: false,
  geminiApiKeyConfigured: true,
  activeProfileId: "interview",
  overlayOpacity: 0.92,
  overlayLayout: "full",
  stealthTier: "glass",
  aiProvider: "gemini",
  vadMode: "balanced",
};

interface MockProfile {
  id: string;
  name: string;
  system_prompt: string;
  is_builtin: boolean;
  position: number;
  max_words: number;
  tone: string;
  created_at: number;
  updated_at: number;
}

interface MockConversation {
  id: string;
  title: string | null;
  profile_id: string | null;
  created_at: number;
  updated_at: number;
}

interface MockMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  audio_transcript: string | null;
  screenshot_id: string | null;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: number;
}

interface MockCapture {
  id: string;
  path: string;
  width: number;
  height: number;
  createdAt: number;
  created_at: number;
}

const now = Date.now();
const profiles: MockProfile[] = [
  "interview",
  "sales",
  "meeting",
  "presentation",
  "negotiation",
  "exam",
].map((id, i) => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  system_prompt: `Builtin ${id} prompt — seeded in the browser mock.`,
  is_builtin: true,
  position: i,
  max_words: 120,
  tone: "neutral",
  created_at: now - 86400_000 * 30,
  updated_at: now - 86400_000 * 30,
}));

const conversations: MockConversation[] = [
  {
    id: "conv-1",
    title: "Senior SWE onsite — Nova Labs",
    profile_id: "interview",
    created_at: now - 86400_000 * 2,
    updated_at: now - 86400_000 * 2 + 1200_000,
  },
  {
    id: "conv-2",
    title: "Acme discovery call",
    profile_id: "sales",
    created_at: now - 86400_000,
    updated_at: now - 86400_000 + 900_000,
  },
];

const messages: MockMessage[] = [
  {
    id: "m-1",
    conversation_id: "conv-1",
    role: "user",
    content: "Tell me about a time you dealt with a production outage.",
    audio_transcript: "Tell me about a time you dealt with a production outage.",
    screenshot_id: null,
    model: "gemini-live",
    tokens_in: null,
    tokens_out: null,
    created_at: now - 86400_000 * 2 + 60_000,
  },
  {
    id: "m-2",
    conversation_id: "conv-1",
    role: "assistant",
    content:
      "We had a full API outage during a launch. I drove the rollback, restored service in 12 minutes, and wrote the post-mortem that led to our canary deploy process.",
    audio_transcript: null,
    screenshot_id: null,
    model: "gemini-live",
    tokens_in: null,
    tokens_out: null,
    created_at: now - 86400_000 * 2 + 90_000,
  },
  {
    id: "m-3",
    conversation_id: "conv-2",
    role: "assistant",
    content:
      "Our platform typically saves teams about 30% on operational costs in the first 90 days. Happy to walk through the ROI for your workflow.",
    audio_transcript: null,
    screenshot_id: null,
    model: "gemini-2.5-flash",
    tokens_in: null,
    tokens_out: null,
    created_at: now - 86400_000 + 120_000,
  },
];

let hotkeyBindings: Array<[string, string]> = [
  ["toggle_visibility", "CmdOrCtrl+Backslash"],
  ["next_step", "CmdOrCtrl+Enter"],
  ["emergency_erase", "CmdOrCtrl+Shift+E"],
  ["toggle_click_through", "CmdOrCtrl+M"],
  ["move_up", "Alt+Up"],
  ["move_down", "Alt+Down"],
  ["move_left", "Alt+Left"],
  ["move_right", "Alt+Right"],
  ["previous_response", "CmdOrCtrl+BracketLeft"],
  ["next_response", "CmdOrCtrl+BracketRight"],
  ["scroll_up", "CmdOrCtrl+Shift+Up"],
  ["scroll_down", "CmdOrCtrl+Shift+Down"],
  ["cycle_stealth_tier", "CmdOrCtrl+Shift+Backslash"],
];

const state = {
  visible: true,
  clickThrough: false,
  captureCounter: 0,
  liveTimers: [] as number[],
  micTimer: undefined as number | undefined,
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const id = (p: string) =>
  `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// ---------------- live-session simulation ----------------

const DEMO_EXCHANGE: { transcript: string[]; response: string; speakable: string }[] = [
  {
    transcript: ["So tell me — ", "walk me through how you'd ", "design a rate limiter."],
    response:
      "I'd use a **token bucket** per API key in Redis — O(1) checks, natural burst handling, and the bucket state survives deploys.",
    speakable: "I'd use a token bucket per API key in Redis — O(1) checks and natural burst handling.",
  },
  {
    transcript: ["And how do you ", "handle retries on the client?"],
    response:
      "**Exponential backoff with jitter** — base 200ms doubling to 8s max, plus an idempotency key so a retry never double-writes.",
    speakable: "Exponential backoff with jitter — 200ms base doubling to 8s, with an idempotency key per request.",
  },
];

let exchangeIdx = 0;

function startLiveSimulation() {
  stopLiveTimers();
  const t = (ms: number, fn: () => void) =>
    state.liveTimers.push(window.setTimeout(fn, ms));

  emitLocal("ai:status", "connecting…");
  t(700, () => emitLocal("ai:status", "ready"));

  const runExchange = (stepIdx: number) => {
    const step = DEMO_EXCHANGE[stepIdx % DEMO_EXCHANGE.length];
    exchangeIdx = stepIdx + 1;
    let offset = 0;
    for (const chunk of step.transcript) {
      t(1600 + offset, () => emitLocal("ai:transcript", chunk));
      offset += 900;
    }
    t(1600 + offset + 400, () => emitLocal("ai:status", "thinking"));
    const responseChunks = step.response.match(/.{1,14}(\s|$)/gs) ?? [step.response];
    // Turns append into the same assistant message — separate them visually.
    if (stepIdx > 0) responseChunks.unshift("\n\n");
    responseChunks.forEach((chunk, i) => {
      t(2200 + offset + i * 120, () => emitLocal("ai:response:text", chunk));
    });
    const endAt = 2200 + offset + responseChunks.length * 120 + 500;
    t(endAt, () => {
      emitLocal("ai:turn:complete", null);
      emitLocal("ai:status", "ready");
      emitLocal("ai:speakable", step.speakable);
    });
    t(endAt + 7000, () => runExchange(stepIdx + 1));
  };

  t(1200, () => runExchange(exchangeIdx));
}

function stopLiveTimers() {
  for (const t of state.liveTimers) window.clearTimeout(t);
  state.liveTimers = [];
}

function fakeCapture(): MockCapture {
  state.captureCounter += 1;
  const ts = Date.now();
  return {
    id: `cap-${state.captureCounter}`,
    path: `mock://capture-${state.captureCounter}`,
    width: 1440,
    height: 900,
    createdAt: ts,
    created_at: ts,
  };
}

const STEALTH_ORDER = ["ghost", "glass", "focus"];

function applyShortcut(action: string) {
  switch (action) {
    case "toggle_visibility":
      state.visible = !state.visible;
      emitLocal("overlay:visibility", state.visible);
      break;
    case "toggle_click_through":
      state.clickThrough = !state.clickThrough;
      emitLocal("overlay:click_through", state.clickThrough);
      break;
    case "cycle_stealth_tier": {
      const i = STEALTH_ORDER.indexOf(settings.stealthTier);
      settings.stealthTier = STEALTH_ORDER[(i + 1) % STEALTH_ORDER.length];
      emitLocal("overlay:stealth_tier", settings.stealthTier);
      break;
    }
    case "emergency_erase":
      messages.length = 0;
      conversations.length = 0;
      emitLocal("clear-sensitive-data", null);
      state.visible = false;
      emitLocal("overlay:visibility", false);
      setTimeout(() => {
        state.visible = true;
        emitLocal("overlay:visibility", true);
      }, 900);
      break;
    default:
      emitLocal("shortcut:triggered", action);
  }
}

// ---------------- keyboard map (mirrors global shortcuts) ----------------

const KEYMAP: Record<string, string> = {
  "\\": "toggle_visibility",
  enter: "next_step",
  m: "toggle_click_through",
  "[": "previous_response",
  "]": "next_response",
};

window.addEventListener("keydown", (e) => {
  const meta = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();
  let action: string | null = null;
  if (meta && e.shiftKey && key === "e") action = "emergency_erase";
  else if (meta && e.shiftKey && key === "\\") action = "cycle_stealth_tier";
  else if (meta && e.shiftKey && key === "arrowup") action = "scroll_up";
  else if (meta && e.shiftKey && key === "arrowdown") action = "scroll_down";
  else if (meta && key in KEYMAP) action = KEYMAP[key];
  else if (e.altKey && key === "arrowup") action = "move_up";
  else if (e.altKey && key === "arrowdown") action = "move_down";
  else if (e.altKey && key === "arrowleft") action = "move_left";
  else if (e.altKey && key === "arrowright") action = "move_right";
  if (!action) return;
  e.preventDefault();
  applyShortcut(action);
});

// ---------------- command handlers ----------------

export async function handleInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const a = (args ?? {}) as Record<string, any>; // mock boundary — mirrors untyped invoke payload
  switch (cmd) {
    // window
    case "toggle_overlay":
      applyShortcut("toggle_visibility");
      return undefined as T;
    case "show_overlay":
      state.visible = true;
      emitLocal("overlay:visibility", true);
      return undefined as T;
    case "hide_overlay":
      state.visible = false;
      emitLocal("overlay:visibility", false);
      return undefined as T;
    case "set_click_through":
      state.clickThrough = !!a.enabled;
      emitLocal("overlay:click_through", state.clickThrough);
      return undefined as T;
    case "open_settings":
      emitLocal("overlay:navigate", "settings");
      return undefined as T;
    case "quit_app":
      state.visible = false;
      emitLocal("overlay:visibility", false);
      return undefined as T;

    // settings
    case "get_settings":
      return { ...settings } as T;
    case "update_settings": {
      const patch = a.patch ?? {};
      const { geminiApiKey, ...rest } = patch;
      Object.assign(settings, rest);
      if (typeof geminiApiKey === "string" && geminiApiKey.trim()) {
        settings.geminiApiKeyConfigured = true;
      }
      if ("overlayLayout" in patch) emitLocal("overlay:layout", settings.overlayLayout);
      if ("stealthTier" in patch) emitLocal("overlay:stealth_tier", settings.stealthTier);
      return { ...settings } as T;
    }

    // hotkeys
    case "get_hotkey_bindings":
      return hotkeyBindings.map((x) => [...x]) as T;
    case "rebind_hotkey":
      hotkeyBindings = hotkeyBindings.map(([act, key]) =>
        act === a.action ? [act, a.newKey] : [act, key],
      );
      return undefined as T;
    case "cycle_stealth_tier":
      applyShortcut("cycle_stealth_tier");
      return undefined as T;
    case "set_overlay_layout":
      settings.overlayLayout = a.layout === "compact" ? "compact" : "full";
      emitLocal("overlay:layout", settings.overlayLayout);
      return undefined as T;

    // chat
    case "chat":
      await delay(650);
      return {
        id: id("msg"),
        role: "assistant",
        content:
          "Short answer: I'd lead with the impact, then the mechanism. **State the outcome first** — numbers beat narrative every time.",
        created_at: Date.now(),
      } as T;

    // profiles
    case "list_profiles":
      return profiles.map((p) => ({ ...p })) as T;
    case "get_profile":
      return (profiles.find((p) => p.id === a.id) ?? null) as T;
    case "create_profile": {
      const p: MockProfile = {
        id: id("profile"),
        name: a.name,
        system_prompt: a.systemPrompt ?? "",
        is_builtin: false,
        position: profiles.length,
        max_words: 120,
        tone: "neutral",
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      profiles.push(p);
      return { ...p } as T;
    }
    case "update_profile": {
      const p = profiles.find((x) => x.id === a.id);
      if (!p) throw new Error("profile not found");
      if (typeof a.name === "string") p.name = a.name;
      if (typeof a.systemPrompt === "string") p.system_prompt = a.systemPrompt;
      if (typeof a.maxWords === "number") p.max_words = a.maxWords;
      if (typeof a.tone === "string") p.tone = a.tone;
      p.updated_at = Date.now();
      return { ...p } as T;
    }
    case "delete_profile": {
      const i = profiles.findIndex((x) => x.id === a.id && !x.is_builtin);
      if (i >= 0) profiles.splice(i, 1);
      return undefined as T;
    }

    // conversations
    case "list_conversations":
      return [...conversations].sort((b, c) => c.updated_at - b.updated_at) as T;
    case "create_conversation": {
      const c: MockConversation = {
        id: id("conv"),
        title: "Live session",
        profile_id: a.profileId ?? null,
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      conversations.push(c);
      return { ...c } as T;
    }
    case "update_conversation_title": {
      const c = conversations.find((x) => x.id === a.id);
      if (c) c.title = a.title;
      return undefined as T;
    }
    case "delete_conversation": {
      const i = conversations.findIndex((x) => x.id === a.id);
      if (i >= 0) conversations.splice(i, 1);
      for (let j = messages.length - 1; j >= 0; j--) {
        if (messages[j].conversation_id === a.id) messages.splice(j, 1);
      }
      return undefined as T;
    }

    // messages
    case "list_messages":
      return messages
        .filter((m) => m.conversation_id === a.conversationId)
        .map((m) => ({ ...m })) as T;
    case "save_message": {
      const m: MockMessage = {
        id: id("msg"),
        conversation_id: a.conversationId,
        role: a.role,
        content: a.content,
        audio_transcript: a.audioTranscript ?? null,
        screenshot_id: a.screenshotId ?? null,
        model: a.model ?? null,
        tokens_in: null,
        tokens_out: null,
        created_at: Date.now(),
      };
      messages.push(m);
      return { ...m } as T;
    }

    // captures
    case "create_capture":
    case "capture_screen": {
      const cap = fakeCapture();
      emitLocal("capture:screen", cap);
      return cap as T;
    }

    // live ai
    case "ai_start_live":
    case "ai_start_live_configured":
      startLiveSimulation();
      return undefined as T;
    case "ai_send_audio":
      return undefined as T;
    case "ai_stop_live":
      stopLiveTimers();
      emitLocal("ai:status", "closed");
      return undefined as T;

    // mic
    case "mic_start":
      if (state.micTimer === undefined) {
        state.micTimer = window.setInterval(() => {
          emitLocal("mic:level", { rmsDb: -50 + Math.random() * 35 });
        }, 150);
      }
      return undefined as T;
    case "mic_stop":
      if (state.micTimer !== undefined) {
        window.clearInterval(state.micTimer);
        state.micTimer = undefined;
      }
      return undefined as T;
    case "set_mic_gate":
      return undefined as T;

    case "dual_brain_step": {
      const cap = fakeCapture();
      emitLocal("capture:screen", cap);
      const step = DEMO_EXCHANGE[exchangeIdx % DEMO_EXCHANGE.length];
      const speakable = step.speakable;
      setTimeout(() => emitLocal("ai:speakable", speakable), 400);
      return { speakable, capture: cap } as T;
    }

    case "export_conversation_markdown":
      return `# Conversation\n\n${messages
        .filter((m) => m.conversation_id === a.conversationId)
        .map((m) => `**${m.role}:** ${m.content}`)
        .join("\n\n")}` as T;

    case "wipe_local_data":
      messages.length = 0;
      conversations.length = 0;
      emitLocal("clear-sensitive-data", null);
      return undefined as T;

    case "vault_index_folder":
      await delay(400);
      return 128 as T;
    case "vault_query":
      return [
        {
          sourcePath: `${a.query ? "~/Documents/notes" : "~/vault"}/acme-pricing.md`,
          chunkText: "Acme renewal lands Q4 — 30% expansion target was agreed in June.",
        },
        {
          sourcePath: "~/Documents/notes/interview-prep.md",
          chunkText: "STAR answers: outage rollback, rate-limiter design, on-call refactor.",
        },
      ] as T;
    case "calendar_hints":
      return [
        { summary: "Technical interview — Nova Labs", start: "Today 2:30 PM" },
        { summary: "Acme renewal sync", start: "Tomorrow 10:00 AM" },
      ] as T;

    default:
      console.warn(`[mock] unhandled command: ${cmd}`, a);
      return undefined as T;
  }
}
