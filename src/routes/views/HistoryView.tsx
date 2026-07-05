/**
 * HistoryView — secondary overlay sheet for past conversations.
 */
import { useEffect, useState } from "react";
import { X, Search } from "lucide-react";
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
}

export function HistoryView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setConversationId = useOverlayStore((s) => s.setConversationId);
  const clearMessages = useOverlayStore((s) => s.clearMessages);
  const appendMessage = useOverlayStore((s) => s.appendMessage);
  const back = useRouter((s) => s.backToAssistant);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [conversations, profiles] = await Promise.all([
        listConversations(),
        listProfiles(),
      ]);
      const profileMap = new Map<string, DbProfile>(profiles.map((p) => [p.id, p]));
      setRows(
        conversations.map((c) => ({
          conversation: c,
          profileName: c.profile_id
            ? profileMap.get(c.profile_id)?.name ?? "Unknown"
            : "—",
        }))
      );
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const filtered = query.trim()
    ? rows.filter(
        (r) =>
          (r.conversation.title ?? "").toLowerCase().includes(query.toLowerCase()) ||
          r.profileName.toLowerCase().includes(query.toLowerCase())
      )
    : rows;

  const onOpen = async (row: Row) => {
    setConversationId(row.conversation.id);
    clearMessages();
    try {
      const msgs = await listMessages(row.conversation.id);
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
    back();
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this conversation?")) return;
    try {
      await deleteConversation(id);
      await reload();
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div
        className={cn(
          "w-full max-w-[420px] max-h-[85vh] flex flex-col rounded-[20px] overflow-hidden",
          "bg-zinc-900/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl"
        )}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-zinc-100">History</h2>
          <button
            onClick={back}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-4 py-3 border-b border-white/[0.06]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations…"
              className="w-full bg-zinc-800/60 border border-zinc-700/60 text-zinc-100 placeholder:text-zinc-500 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center">
              <p className="text-sm text-zinc-400">
                {rows.length === 0
                  ? "No conversations yet."
                  : "No conversations match your search."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((row) => (
                <li
                  key={row.conversation.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-3 flex items-start gap-3 hover:border-zinc-700 transition-colors"
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
                    <div className="mt-1">
                      <span className="text-[10px] uppercase tracking-wide text-zinc-500 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded">
                        {row.profileName}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => onDelete(row.conversation.id)}
                    className="shrink-0 text-[11px] text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
