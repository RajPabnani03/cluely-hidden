import {
  createConversation,
  saveMessage,
  updateConversationTitle,
  getSettings,
  type ChatMessage,
} from "./tauri";

/** Persist in-memory live session to SQLite for History. */
export async function persistLiveSessionToHistory(args: {
  conversationId: string | null;
  messages: ChatMessage[];
  transcript: string;
  profileId: string | null;
}): Promise<string | null> {
  const { messages, transcript, profileId } = args;
  let convId = args.conversationId;

  const hasContent =
    messages.some((m) => m.content.trim().length > 0) ||
    transcript.trim().length > 0;
  if (!hasContent) return convId;

  try {
    if (!convId) {
      const conv = await createConversation(profileId);
      convId = conv.id;
    }

    if (transcript.trim()) {
      await saveMessage({
        conversationId: convId,
        role: "user",
        content: transcript.trim(),
        audioTranscript: transcript.trim(),
        model: "gemini-live",
      });
    }

    for (const m of messages) {
      if (!m.content.trim()) continue;
      await saveMessage({
        conversationId: convId,
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
        model: "gemini-live",
      });
    }

    const titleSource =
      transcript.trim().slice(0, 80) ||
      messages.find((m) => m.content.trim())?.content.trim().slice(0, 80) ||
      "Live session";
    await updateConversationTitle(convId, titleSource);

    return convId;
  } catch (e) {
    console.error("persistLiveSessionToHistory failed:", e);
    return convId;
  }
}

export async function loadOverlayOpacity(): Promise<number> {
  try {
    const s = await getSettings();
    return s.overlayOpacity ?? 0.92;
  } catch {
    return 0.92;
  }
}