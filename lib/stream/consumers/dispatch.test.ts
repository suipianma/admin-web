import { describe, expect, it, vi } from "vitest";
import { dispatchStreamEvent } from "./dispatch";
import type { ChatStreamConsumerDeps } from "./types";

function createDeps(
  overrides: Partial<ChatStreamConsumerDeps> = {}
): ChatStreamConsumerDeps {
  return {
    isViewingConversation: () => true,
    streamMetaRef: { current: new Map() },
    assistantIdRef: { current: null },
    streamIdsRef: { current: new Map() },
    streamStopsRef: { current: new Map() },
    pushStream: vi.fn(),
    updateMessage: vi.fn(),
    mutateDraftMessages: vi.fn(),
    appendToolCall: vi.fn(),
    completeToolCall: vi.fn(),
    appendAgentStep: vi.fn(),
    flushNow: vi.fn(),
    clearStreamingState: vi.fn(),
    finishStreamForConversation: vi.fn(),
    cancelStream: vi.fn(),
    resetStream: vi.fn(),
    removeMessages: vi.fn(),
    syncFromServer: vi.fn().mockResolvedValue(undefined),
    saveActiveStream: vi.fn(),
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } as never,
    limitErrorMsg: "limit",
    ...overrides,
  };
}

describe("dispatchStreamEvent", () => {
  it("rag_citations 应写入消息 citations", () => {
    const updateMessage = vi.fn();
    const deps = createDeps({ updateMessage });

    dispatchStreamEvent(
      {
        type: "rag_citations",
        conversationId: 1,
        assistantId: 99,
        citations: [
          {
            chunkId: 1,
            documentName: "doc",
            snippet: "snip",
            score: 0.9,
          },
        ],
      },
      deps
    );

    expect(updateMessage).toHaveBeenCalledWith(99, {
      citations: expect.any(Array),
    });
  });
});
