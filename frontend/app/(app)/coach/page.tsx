"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import IconButton from "@/components/IconButton";
import PageHeader from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { STARTER_PROMPTS, toolLabel, toolSummary } from "@/lib/coach";
import type { CoachMessage, CoachStatus, Conversation } from "@/lib/types";

export default function CoachPage() {
  const confirm = useConfirm();
  const [status, setStatus] = useState<CoachStatus | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  // Live reply being streamed, plus which tools it has reached for so far.
  const [streaming, setStreaming] = useState<string | null>(null);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.coachStatus().then(setStatus).catch(() => {});
    api
      .listConversations()
      .then((list) => {
        setConversations(list);
        if (list.length) void selectConversation(list[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  // Keep the newest content in view as the reply streams in.
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming, activeTools]);

  async function selectConversation(id: number) {
    setActiveId(id);
    setError(null);
    const conversation = await api.getConversation(id);
    setMessages(conversation.messages);
  }

  function startNew() {
    setActiveId(null);
    setMessages([]);
    setError(null);
  }

  async function onDelete(id: number) {
    const ok = await confirm({
      title: "Delete this conversation?",
      body: "The whole transcript goes with it.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await api.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === activeId) startNew();
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;

    setBusy(true);
    setError(null);
    setInput("");
    setStreaming("");
    setActiveTools([]);

    try {
      // A conversation is created lazily, so an abandoned "New chat" leaves
      // nothing behind.
      let conversationId = activeId;
      if (conversationId === null) {
        const created = await api.createConversation();
        conversationId = created.id;
        setActiveId(created.id);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: -Date.now(), // placeholder until the transcript is reloaded
          role: "user",
          content,
          tool_calls: null,
          created_at: new Date().toISOString(),
        },
      ]);

      let reply = "";
      const tools: string[] = [];

      for await (const event of api.sendCoachMessage(conversationId, content)) {
        if (event.type === "delta") {
          reply += event.text;
          setStreaming(reply);
        } else if (event.type === "tool") {
          tools.push(event.name);
          setActiveTools([...tools]);
        } else if (event.type === "error") {
          setError(event.message);
          setStreaming(null);
          return;
        } else if (event.type === "done") {
          setMessages((prev) => [
            ...prev,
            {
              id: event.message_id,
              role: "assistant",
              content: reply,
              tool_calls: tools.map((name) => ({ name, input: {} })),
              created_at: new Date().toISOString(),
            },
          ]);
          setStreaming(null);
        }
      }

      // Titles are derived server-side from the first message.
      setConversations(await api.listConversations());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The coach is unreachable.");
      setStreaming(null);
    } finally {
      setBusy(false);
      setActiveTools([]);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  const isEmpty = messages.length === 0 && streaming === null;

  return (
    <div>
      <PageHeader
        eyebrow="Ask"
        title="Coach"
        description="Ask about your training and the coach reads your own logbook, sessions, and video analyses before answering."
        action={
          <button onClick={startNew} disabled={busy} className="btn-primary">
            New chat
          </button>
        }
      />

      {status && !status.available && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          The coach isn&apos;t configured yet. Set <code>ANTHROPIC_API_KEY</code> in{" "}
          <code>backend/.env</code> and restart the API.
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Conversation list */}
        <aside className="card h-max p-2 lg:col-span-1">
          <p className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-steel-400">
            Conversations
          </p>
          {conversations.length === 0 && (
            <p className="px-2 pb-2 pt-1 text-sm text-steel-400">
              Nothing yet — ask a question to start one.
            </p>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-lg border-l-2 px-3 py-2 text-sm transition-all duration-200 ${
                c.id === activeId
                  ? "border-lake-500 bg-lake-50 text-lake-700"
                  : "border-transparent text-steel-600 hover:bg-steel-100"
              }`}
            >
              <button
                onClick={() => void selectConversation(c.id)}
                disabled={busy}
                className="min-w-0 flex-1 truncate text-left font-medium"
              >
                {c.title}
              </button>
              <IconButton
                icon="trash"
                label={`Delete ${c.title}`}
                onClick={() => void onDelete(c.id)}
                tone="danger"
                className="h-7 w-7"
              />
            </div>
          ))}
        </aside>

        {/* Transcript */}
        <section className="card flex min-h-[28rem] flex-col lg:col-span-3">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {isEmpty && (
              <EmptyState
                bare
                icon="coach"
                title="Ask anything about your climbing"
                hint="The coach reads your own data before answering, so it helps to be specific. A few places to start:"
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    {STARTER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => void send(prompt)}
                        disabled={busy || status?.available === false}
                        className="rounded-full border border-steel-200 bg-white px-3 py-1.5 text-sm text-steel-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-lake-300 hover:bg-lake-50 hover:text-lake-700 hover:shadow-card disabled:opacity-50 disabled:hover:translate-y-0"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                }
              />
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={m.role === "user" ? "flex justify-end" : undefined}
              >
                {m.role === "assistant" && toolSummary(m.tool_calls) && (
                  <p className="mb-1.5 text-xs text-steel-400">
                    {toolSummary(m.tool_calls)}
                  </p>
                )}
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-gradient-to-br from-lake-500 to-lake-600 px-4 py-2.5 text-sm text-white shadow-sm"
                      : "whitespace-pre-wrap text-sm leading-relaxed text-steel-700"
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}

            {streaming !== null && (
              <div>
                {activeTools.length > 0 && (
                  <p className="mb-1.5 text-xs text-steel-400">
                    Checking{" "}
                    {Array.from(new Set(activeTools)).map(toolLabel).join(", ")}…
                  </p>
                )}
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-steel-700">
                  {streaming}
                  <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-lake-500 align-text-bottom" />
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div ref={bottom} />
          </div>

          <form
            onSubmit={onSubmit}
            className="flex items-end gap-2 border-t border-steel-200 p-3"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder="Ask your coach… (Enter to send, Shift+Enter for a new line)"
              disabled={busy || status?.available === false}
              className="field mt-0 flex-1 resize-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim() || status?.available === false}
              className="btn-primary"
            >
              {busy ? "…" : "Send"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
