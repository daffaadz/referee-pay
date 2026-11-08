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

function renderInlineTokens(text: string): React.ReactNode[] {
  const regex = /(\*\*[\s\S]*?\*\*|`[^`]+`)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];
    const key = `tok_${match.index}`;

    if (token.startsWith("**") && token.endsWith("**")) {
      const inner = token.slice(2, -2).trim();

      if (inner.startsWith("`") && inner.endsWith("`")) {
        nodes.push(
          <code
            key={key}
            className="px-1.5 py-0.5 rounded bg-primary-50 font-mono text-[11px] font-semibold text-primary-900 border border-primary-200"
          >
            {inner.slice(1, -1)}
          </code>
        );
      } else if (inner === "RELEASED") {
        nodes.push(
          <span
            key={key}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
          >
            RELEASED
          </span>
        );
      } else if (inner === "FUNDS_HELD") {
        nodes.push(
          <span
            key={key}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
          >
            FUNDS_HELD
          </span>
        );
      } else if (inner === "REFUNDED") {
        nodes.push(
          <span
            key={key}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-800 border border-neutral-300"
          >
            REFUNDED
          </span>
        );
      } else if (inner === "DISPUTED") {
        nodes.push(
          <span
            key={key}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200"
          >
            DISPUTED
          </span>
        );
      } else {
        nodes.push(
          <strong key={key} className="font-semibold text-neutral-900">
            {inner}
          </strong>
        );
      }
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="px-1.5 py-0.5 rounded bg-neutral-100 font-mono text-[11px] text-neutral-800 border border-neutral-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.substring(lastIndex));
  }

  return nodes;
}

function FormattedAnalystMessage({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      elements.push(<div key={`sp_${i}`} className="h-1.5" />);
      continue;
    }

    if (/^(\-{3,}|\*{3,})$/.test(line)) {
      elements.push(
        <hr key={`hr_${i}`} className="my-2.5 border-t border-neutral-200" />
      );
      continue;
    }

    if (line.startsWith("### ")) {
      elements.push(
        <h4
          key={`h4_${i}`}
          className="text-xs font-semibold text-neutral-900 uppercase tracking-wide mt-3 mb-1.5 pb-1 border-b border-neutral-100 flex items-center gap-1.5 first:mt-0"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary-600 shrink-0" />
          <span>{renderInlineTokens(line.replace(/^###\s+/, ""))}</span>
        </h4>
      );
      continue;
    }

    if (line.startsWith("## ") || line.startsWith("# ")) {
      elements.push(
        <h3
          key={`h3_${i}`}
          className="text-sm font-semibold text-neutral-900 mt-3 mb-1.5 first:mt-0"
        >
          {renderInlineTokens(line.replace(/^#{1,2}\s+/, ""))}
        </h3>
      );
      continue;
    }

    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      elements.push(
        <div
          key={`num_${i}`}
          className="flex items-start gap-2 my-1 pl-1 text-xs text-neutral-800"
        >
          <span className="font-mono text-[11px] font-semibold text-primary-700 shrink-0 min-w-[16px]">
            {numMatch[1]}.
          </span>
          <div className="flex-1 leading-relaxed">
            {renderInlineTokens(numMatch[2])}
          </div>
        </div>
      );
      continue;
    }

    const bulletMatch = line.match(/^[\*\-]\s+(.*)$/);
    if (bulletMatch) {
      elements.push(
        <div
          key={`bul_${i}`}
          className="flex items-start gap-2 my-1 pl-1 text-xs text-neutral-800"
        >
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary-600 shrink-0" />
          <div className="flex-1 leading-relaxed">
            {renderInlineTokens(bulletMatch[1])}
          </div>
        </div>
      );
      continue;
    }

    elements.push(
      <p
        key={`p_${i}`}
        className="my-1 text-xs text-neutral-700 leading-relaxed first:mt-0 last:mb-0"
      >
        {renderInlineTokens(line)}
      </p>
    );
  }

  return <div className="space-y-0.5">{elements}</div>;
}

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
      <div className="max-h-96 overflow-y-auto space-y-3 p-2 bg-neutral-50/60 rounded-md border border-neutral-200/80">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`rounded-lg p-3.5 text-xs leading-relaxed ${
                m.role === "user"
                  ? "max-w-[85%] bg-primary-700 text-white"
                  : "w-full max-w-[95%] bg-surface border border-neutral-200/90 text-neutral-900 shadow-sm"
              }`}
            >
              {m.role === "user" ? (
                <p className="whitespace-pre-line">{m.content}</p>
              ) : (
                <FormattedAnalystMessage content={m.content} />
              )}

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
