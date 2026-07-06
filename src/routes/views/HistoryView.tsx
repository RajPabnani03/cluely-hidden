/**
 * HistoryView — secondary overlay sheet for past conversations.
 *
 * Lists all conversations stored in SQLite, lets the user search by
 * title or message content, load a conversation back into the Assistant
 * (populating the overlay store), or delete it after confirmation.
 *
 * Notes on IPC:
 *  - listConversations, deleteConversation, listMessages, getProfile
 *    all exist in src-tauri/src/ipc/commands.rs (Phase 3A).
 *  - There is no Rust `search_conversations` command yet (out of scope
 *    for this lane). Search is performed client-side by fetching every
 *    conversation's messages and matching against title + content.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Search,
  Trash2,
  Clock,
  MessageSquare,
  Inbox,
} from "lucide-react";
import {
  type DbConversation,
  type DbMessage,
  type DbProfile,
  deleteConversation,
  getProfile,
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
  /** Cached message bodies, used for content-level search + counting. */
  messageCount: number;
  messages: DbMessage[];
  /** Earliest user/assistant text snippet, shown under the title. */
  preview: string | null;
}

export function HistoryView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const setConversationId = useOverlayStore((s) => s.setConversationId);
  const clearMessages = useOverlayStore((s) => s.clearMessages);
  const appendMessage = useOverlayStore((s) => s.appendMessage);
  const back = useRouter((s) => s.backToAssistant);

  // ---------- Loaders ----------

  const profileCache = useRef<Map<string, DbProfile>>(new Map());

  const ensureProfilesLoaded = useCallback(async () => {
    if (profileCache.current.size > 0) return profileCache.current;
    const profiles = await listProfiles();
    const map = new Map<string, DbProfile>();
    for (const p of profiles) map.set(p.id, p);
    profileCache.current = map;
    return map;
  }, []);

  const lookupProfileName = useCallback(
    async (id: string | null): Promise<string> => {
      if (!id) return "Default";
      const cached = profileCache.current.get(id);
      if (cached) return cached.name;
      try {
        const p = await getProfile(id);
        if (p) {
          profileCache.current.set(p.id, p);
          return p.name;
        }
      } catch {
        /* ignore */
      }
      return "Unknown profile";
    },
    [],
  );

  const buildRows = useCallback(
    async (conversations: DbConversation[]): Promise<Row[]> => {
      const map = await ensureProfilesLoaded();
      const built: Row[] = [];
      for (const c of conversations) {
        const msgs = await listMessages(c.id).catch(() => [] as DbMessage[]);
        const firstUser = msgs.find((m) => m.role === "user");
        const preview = (firstUser?.content ?? msgs[0]?.content ?? "").trim();
        built.push({
          conversation: c,
          profileName: c.profile_id
            ? map.get(c.profile_id)?.name ?? "Unknown profile"
            : "Default",
          messageCount: msgs.length,
          messages: msgs,
          preview: preview ? preview.slice(0, 140) : null,
        });
      }
      // Sort newest first by updated_at (defensive — DB may not order).
      built.sort((a, b) => b.conversation.updated_at - a.conversation.updated_at);
      return built;
    },
    [ensureProfilesLoaded],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const conversations = await listConversations();
      const built = await buildRows(conversations);
      // Re-resolve any profile names we hadn't cached yet.
      const needLookup = built.filter(
        (r) => r.profileName === "Unknown profile" && r.conversation.profile_id,
      );
      await Promise.all(
        needLookup.map(async (r) => {
          r.profileName = await lookupProfileName(r.conversation.profile_id);
        }),
      );
      setRows(built);
    } catch (err) {
      console.error("HistoryView load failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [buildRows, lookupProfileName]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // ---------- Filtering ----------

  const filtered = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const titleHit = (r.conversation.title ?? "").toLowerCase().includes(q);
      if (titleHit) return true;
      const profileHit = r.profileName.toLowerCase().includes(q);
      if (profileHit) return true;
      // Content-level search: scan cached messages.
      const contentHit = r.messages.some((m) =>
        (m.content ?? "").toLowerCase().includes(q),
      );
      return contentHit;
    });
  }, [rows, query]);

  // ---------- Actions ----------

  const onOpen = async (row: Row) => {
    setOpeningId(row.conversation.id);
    setError(null);
    try {
      const msgs = await listMessages(row.conversation.id);
      setConversationId(row.conversation.id);
      clearMessages();
      for (const m of msgs) {
        appendMessage({
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
          createdAt: m.created_at,
        });
      }
      back();
    } catch (err) {
      console.error("HistoryView open failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOpeningId(null);
    }
  };

  const onConfirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.conversation.id;
    try {
      await deleteConversation(id);
      // If we just deleted the currently-loaded conversation, clear the store.
      const currentId = useOverlayStore.getState().currentConversationId;
      if (currentId === id) {
        useOverlayStore.getState().resetSensitiveState();
      }
      setPendingDelete(null);
      await reload();
    } catch (err) {
      console.error("HistoryView delete failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setPendingDelete(null);
    }
  };

  // ---------- Render ----------

  const hasAnyConversations = rows.length > 0;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div
        className={cn(
          "w-full max-w-[420px] max-h-[85vh] flex flex-col rounded-[20px] overflow-hidden",
          "bg-zinc-900/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl",
        )}
        role="dialog"
        aria-label="Conversation history"
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-100">History</h2>
            {hasAnyConversations && !loading && (
              <span className="text-[10px] uppercase tracking-wide text-zinc-500 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded">
                {rows.length}
              </span>
            )}
          </div>
          <button
            onClick={back}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            aria-label="Close history"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Search */}
        {hasAnyConversations && (
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title or message…"
                className="w-full bg-zinc-800/60 border border-zinc-700/60 text-zinc-100 placeholder:text-zinc-500 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                aria-label="Search conversations"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wide text-zinc-500 hover:text-zinc-300 px-1.5 py-0.5 rounded"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {error && (
            <div
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300"
              role="alert"
            >
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-zinc-500">Loading conversations…</p>
            </div>
          ) : !hasAnyConversations ? (
            <EmptyState onStart={back} />
          ) : filtered.length === 0 ? (
            <div
              className="rounded-lg border border-dashed border-zinc-800 p-6 text-center"
              role="status"
            >
              <p className="text-sm text-zinc-400">
                No conversations match &ldquo;{query}&rdquo;.
              </p>
              <button
                onClick={() => setQuery("")}
                className="mt-3 text-xs text-blue-400 hover:text-blue-300"
              >
                Clear search
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((row) => (
                <ConversationRow
                  key={row.conversation.id}
                  row={row}
                  isOpening={openingId === row.conversation.id}
                  onOpen={onOpen}
                  onDelete={setPendingDelete}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <DeleteConfirmModal
          row={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={onConfirmDelete}
        />
      )}
    </div>
  );
}

// ---------- Subcomponents ----------

function ConversationRow({
  row,
  isOpening,
  onOpen,
  onDelete,
}: {
  row: Row;
  isOpening: boolean;
  onOpen: (row: Row) => void;
  onDelete: (row: Row) => void;
}) {
  const title = row.conversation.title ?? "Untitled conversation";
  return (
    <li
      className={cn(
        "rounded-lg border border-zinc-800 bg-zinc-800/40 p-3 flex items-start gap-3",
        "hover:border-zinc-700 hover:bg-zinc-800/60 transition-colors",
      )}
    >
      <button
        onClick={() => onOpen(row)}
        disabled={isOpening}
        className="flex-1 min-w-0 text-left disabled:opacity-60"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-zinc-100 truncate">
            {isOpening ? "Loading…" : title}
          </span>
          <span className="text-[11px] text-zinc-500 shrink-0">
            {formatRelativeTime(row.conversation.updated_at)}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wide text-zinc-500 bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 rounded">
            {row.profileName}
          </span>
          <span className="text-[10px] text-zinc-500 inline-flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {row.messageCount} {row.messageCount === 1 ? "msg" : "msgs"}
          </span>
        </div>
        {row.preview && (
          <p className="mt-2 text-[12px] text-zinc-400 line-clamp-2 leading-relaxed">
            {row.preview}
          </p>
        )}
      </button>
      <button
        onClick={() => onDelete(row)}
        className="shrink-0 self-start mt-0.5 inline-flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
        aria-label="Delete conversation"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center">
        <Inbox className="w-5 h-5 text-zinc-500" />
      </div>
      <p className="text-sm font-medium text-zinc-200">
        No past sessions yet
      </p>
      <p className="text-[12px] text-zinc-500 max-w-[260px]">
        Start one from the Assistant view — once you finish a conversation
        it&rsquo;ll show up here.
      </p>
      <button
        onClick={onStart}
        className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
      >
        Open Assistant
      </button>
    </div>
  );
}

function DeleteConfirmModal({
  row,
  onCancel,
  onConfirm,
}: {
  row: Row;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const title = row.conversation.title ?? "Untitled conversation";
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm delete"
    >
      <div className="w-full max-w-[340px] rounded-2xl bg-zinc-900/95 backdrop-blur-xl border border-white/[0.1] shadow-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-zinc-100">
              Delete conversation?
            </h3>
            <p className="mt-1 text-[12px] text-zinc-400 leading-relaxed">
              &ldquo;<span className="text-zinc-200">{title}</span>&rdquo; and
              its {row.messageCount} {row.messageCount === 1 ? "message" : "messages"}{" "}
              will be permanently removed.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
            autoFocus
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
