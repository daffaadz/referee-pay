"use client";

import React, { useState, useRef } from "react";
import {
  Sparkle,
  ChatCircleDots,
  PaperPlaneRight,
  ArrowsClockwise,
  Warning,
  CheckCircle,
  Funnel,
  X,
} from "@phosphor-icons/react/dist/ssr";
import type { WidgetAction } from "@/agent/analyst";

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  widgetAction?: WidgetAction;
}

interface RefereeAnalystPanelProps {
  onApplyWidgetAction?: (action: WidgetAction) => void;
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  "Which deals are most likely to be refunded this week?",
  "Show released money and payouts",
  "Which buyers opened claims?",
];

export function RefereeAnalystPanel({
  onApplyWidgetAction,
  isOpen,
  onClose,
}: RefereeAnalystPanelProps) {
  const messageIdCounter = useRef(1);
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "intro_msg",
      role: "assistant",
      content:
        "Hello! I am your Referee Analyst. I continuously monitor your active escrow deals, carrier tracking deadlines, claims, and PayPal financial ledger. How can I help you optimize your portfolio today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const sendMessage = async (userText: string) => {
    if (!userText.trim() || loading) return;

    messageIdCounter.current += 1;
    const userMsg: MessageItem = {
      id: `user_${messageIdCounter.current}`,
      role: "user",
      content: userText.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/seller/analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText.trim(),
          history: historyPayload,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Analyst request failed with status ${res.status}`);
      }

      const data = await res.json();
      messageIdCounter.current += 1;
      const assistantMsg: MessageItem = {
        id: `asst_${messageIdCounter.current}`,
        role: "assistant",
        content: data.reply,
        toolsUsed: data.toolsUsed,
        widgetAction: data.widgetAction,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // If the agent created or modified a widget view, notify the dashboard
      if (data.widgetAction && onApplyWidgetAction) {
        onApplyWidgetAction(data.widgetAction);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error communicating with Referee Analyst";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface rounded-lg border border-primary-200 shadow-md p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center">
            <Sparkle size={18} weight="fill" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-neutral-900">Referee Analyst</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-50 text-primary-700 border border-primary-100">
                Studio Agent Framework
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Read-only portfolio risk and verified PayPal ledger intelligence.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-sm text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
          aria-label="Close analyst panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Quick Prompts */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
          Suggested questions
        </span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp}
              disabled={loading}
              onClick={() => sendMessage(qp)}
              className="text-xs px-2.5 py-1 rounded-full border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 transition text-left"
            >
              {qp}
            </button>
          ))}
        </div>
      </div>

      {/* Message History */}
      <div className="max-h-80 overflow-y-auto space-y-3 p-2 bg-neutral-50/60 rounded-md border border-neutral-200/80">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-3 text-xs leading-relaxed ${
                m.role === "user"
                  ? "bg-primary-700 text-white"
                  : "bg-surface border border-neutral-200 text-neutral-900 shadow-sm"
              }`}
            >
              <p className="whitespace-pre-line">{m.content}</p>

              {/* Tools Executed by Agent */}
              {m.toolsUsed && m.toolsUsed.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-neutral-100 flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-500">
                  <span className="font-semibold text-neutral-600">Verified tools queried:</span>
                  {m.toolsUsed.map((toolName) => (
                    <span
                      key={toolName}
                      className="px-1.5 py-0.5 rounded-sm bg-neutral-100 text-neutral-700 font-mono"
                    >
                      {toolName}
                    </span>
                  ))}
                </div>
              )}

              {/* Widget Action Triggered */}
              {m.widgetAction && (
                <div className="mt-2 p-2 rounded-sm bg-primary-50 border border-primary-100 text-[11px] text-primary-900 space-y-1">
                  <div className="flex items-center gap-1 font-semibold">
                    <Funnel size={12} weight="bold" />
                    <span>Dashboard View Configured: {m.widgetAction.title}</span>
                  </div>
                  <p className="text-primary-700">{m.widgetAction.explanation}</p>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 p-3 text-xs text-neutral-500 bg-surface border border-neutral-200 rounded-lg max-w-[70%]">
            <ArrowsClockwise size={14} className="animate-spin text-primary-700" />
            <span>Analyzing seller portfolio and ledger telemetry...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-2.5 text-xs text-danger-700 bg-danger-50 border border-danger-100 rounded-lg">
            <Warning size={14} weight="bold" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          disabled={loading}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Referee Analyst (e.g. Which deals are most likely to be refunded?)..."
          className="flex-1 px-3 py-2 text-xs rounded-sm border border-neutral-300 bg-surface text-neutral-900 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-primary-700 hover:bg-primary-800 disabled:opacity-50 text-white text-xs font-medium transition"
        >
          <PaperPlaneRight size={14} weight="bold" />
          <span>Ask</span>
        </button>
      </form>
    </div>
  );
}
