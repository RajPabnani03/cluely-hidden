/**
 * TypeScript types that mirror the SQLite schema in src-tauri/src/db/.
 *
 * Rust types live in `src-tauri/src/db/models.rs` (or wherever the
 * Phase 3A agent put them). These interfaces must match the shape of
 * what `list_profiles`, `list_conversations`, `list_messages`, and
 * `list_captures` return from IPC.
 *
 * Convention: timestamps are Unix epoch **milliseconds** (i64 in Rust,
 * number in TS). All ids are opaque strings (UUIDv4 from the Rust side).
 */

/** A profile as stored in SQLite + returned by IPC. */
export interface DbProfile {
  id: string;
  name: string;
  system_prompt: string;
  is_builtin: boolean;
  position: number;
  created_at: number;
  updated_at: number;
}

/** A conversation (chat session) — owns a sequence of messages. */
export interface DbConversation {
  id: string;
  title: string | null;
  profile_id: string | null;
  created_at: number;
  updated_at: number;
}

/** A single chat message inside a conversation. */
export interface DbMessage {
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

/** A captured screenshot or audio chunk on disk. */
export interface DbCapture {
  id: string;
  kind: "screen" | "audio";
  file_path: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  created_at: number;
}
