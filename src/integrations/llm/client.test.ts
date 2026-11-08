import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLlmModel } from "./client";

describe("LLM Client Thought Signature Preservation (Gemini 2.5/3.5)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exports getLlmModel and returns a LanguageModelV1 instance", () => {
    process.env.GEMINI_API_KEY = "dummy_test_key";
    const model = getLlmModel("gemini-3.5-flash-lite");
    expect(model).toBeDefined();
    expect(model.modelId).toBe("gemini-3.5-flash-lite");
  });

  it("attaches cached thoughtSignature onto functionCall model parts during subsequent turns", async () => {
    // Test the thought signature injection logic directly
    const originalFetch = global.fetch;

    const dummySig = "EmAKXgFpFH0TcDDIjRg09R3wdMuPGeS7t4ity8JSMmoKhHYL4sYlI8hJ";
    let requestCount = 0;
    let interceptedReq2Body: any = null;

    global.fetch = vi.fn().mockImplementation(async (url: any, init: any) => {
      requestCount++;
      if (requestCount === 1) {
        // First turn: Gemini returns a function call with a thoughtSignature
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: "model",
                  parts: [
                    {
                      functionCall: {
                        name: "list_deals",
                        args: { status: "FUNDS_HELD" },
                        id: "call_123456",
                      },
                      thoughtSignature: dummySig,
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } else if (requestCount === 2) {
        // Second turn: Inspect what the client sends back in request body
        interceptedReq2Body = JSON.parse(init.body);
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: "model",
                  parts: [{ text: "You have 1 active deal." }],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200 });
    });

    try {
      process.env.GEMINI_API_KEY = "test_key";
      const model = getLlmModel("gemini-3.5-flash-lite");

      // Generate turn 1 (model calls function)
      const res1 = await model.doGenerate({
        inputFormat: "messages",
        mode: {
          type: "regular",
          tools: [
            {
              type: "function",
              name: "list_deals",
              description: "List deals",
              parameters: { type: "object", properties: { status: { type: "string" } } },
            },
          ],
        },
        prompt: [{ role: "user", content: [{ type: "text", text: "Show deals" }] }],
      });

      expect(res1.toolCalls).toBeDefined();
      expect(res1.toolCalls?.[0]?.toolName).toBe("list_deals");

      // Generate turn 2: simulating @ai-sdk/google where functionCall is passed without thoughtSignature
      await model.doGenerate({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: [
          { role: "user", content: [{ type: "text", text: "Show deals" }] },
          {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                toolCallId: "call_123456",
                toolName: "list_deals",
                args: { status: "FUNDS_HELD" },
              },
            ],
          },
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "call_123456",
                toolName: "list_deals",
                result: { deals: [{ id: "deal_1", title: "Wallet" }] },
              },
            ],
          },
        ],
      });

      // Verify that customFetch in client.ts intercepted and restored the thoughtSignature!
      expect(interceptedReq2Body).toBeDefined();
      const modelContent = interceptedReq2Body.contents.find((c: any) => c.role === "model");
      expect(modelContent).toBeDefined();
      const fnCallPart = modelContent.parts.find((p: any) => p.functionCall);
      expect(fnCallPart).toBeDefined();
      expect(fnCallPart.thoughtSignature).toBe(dummySig);
      expect(fnCallPart.thought_signature).toBe(dummySig);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
