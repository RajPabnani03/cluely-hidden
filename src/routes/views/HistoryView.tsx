/**
 * HistoryView — past conversations.
 *
 *   - Loads `listConversations()` on mount
 *   - Search bar filters by title (case-insensitive substring)
 *   - Each row: title, profile name, last message preview, timestamp
 *   - Click → loads conversation (sets currentConversationId, navigates to
 *     Assistant view, loads messages via listMessages)
 *   - Delete button per row (with confirmation)
 *   - Empty state when no conversations
 *
 * Phase 4: will also show first-message preview by joining on the
 * first row of `listMessages`. For v0.1.0 we just show "(empty)" or
 * whatever the conversation title is.
 */

import { useEffect, useState } from "react";
import {
  type DbConversation,
  type DbProfile,
  deleteConversation,
  listConversations,
  listMessages,
  listProfiles,
} from "../../lib/tauri";
import { useOverlayStore } from "../../lib/store";
import { useRouter } from "../../lib/router";
import { formatRelativeTime, cn } from "../../lib/utils";

interface Row {
  conversation: DbConversation;
  profileName: string;
  preview: string;
}

export function HistoryView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setConversationId = useOverlayStore((s) => s.setConversationId);
  const clearMessages = useOverlayStore((s) => s.clearMessages);
  const appendMessage = useOverlayStore((s) => s.appendMessage);
  const setView = useRouter((s) => s.setView);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [conversations, profiles] = await Promise.all([
        listConversations(),
        listProfiles(),
      ]);
      // For v0.1.0 we don't fetch first-message previews (would be N+1).
      // Phase 4 will batch this with a single SQL JOIN.
      const profileMap = new Map<string, DbProfile>(
        profiles.map((p) => [p.id, p]),
      );
      const built: Row[] = conversations.map((c) => ({
        conversation: c,
        profileName: c.profile_id
          ? profileMap.get(c.profile_id)?.name ?? "Unknown"
          : "—",
        preview: "(empty)", // placeholder
      }));
      setRows(built);
    } catch (err) {
      console.error(err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const filtered = query.trim()
    ? rows.filter((r) => {
        const q = query.toLowerCase();
        return (
          (r.conversation.title ?? "").toLowerCase().includes(q) ||
          r.profileName.toLowerCase().includes(q)
        );
      })
    : rows;

  const onOpen = async (row: Row) => {
    setConversationId(row.conversation.id);
    clearMessages();
    try {
      const msgs = await listMessages(row.conversation.id);
      // Bulk-load: clear then append one by one (no setMessages in store yet)
      clearMessages();
      for (const m of msgs) {
        appendMessage({
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
          createdAt: m.created_at,
        });
      }
    } catch (err) {
      console.error("listMessages failed:", err);
    }
    setView("assistant");
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this conversation? This cannot be undone.")) return;
    try {
      await deleteConversation(id);
      await reload();
    } catch (err) {
      console.error(err);
      setError(String(err));
    }
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-4 max-w-3xl mx-auto w-full">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-zinc-400">
          {rows.length === 0
            ? "No conversations yet."
            : `${rows.length} conversation${rows.length === 1 ? "" : "s"}`}
        </p>
      </header>

      <div className="sticky top-0 bg-zinc-900 -mx-6 px-6 pb-3 pt-1">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or profile…"
          className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center">
          <p className="text-sm text-zinc-400">
            {rows.length === 0
              ? "No conversations yet. Start a session in the Assistant view."
              : "No conversations match your search."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((row) => (
            <li
              key={row.conversation.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 flex items-start gap-3 hover:border-zinc-700 transition-colors"
            >
              <button
                onClick={() => onOpen(row)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-100 truncate">
                    {row.conversation.title ?? "Untitled"}
                  </span>
                  <span className="text-[11px] text-zinc-500 shrink-0">
                    {formatRelativeTime(row.conversation.updated_at)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded border",
                      "bg-zinc-800 border-zinc-700 text-zinc-300",
                    )}
                  >
                    {row.profileName}
                  </span>
                  <span className="truncate">{row.preview}</span>
                </div>
              </button>
              <button
                onClick={() => onDelete(row.conversation.id)}
                className="shrink-0 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                title="Delete conversation"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
