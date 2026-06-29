import { describe, expect, it } from "vitest";
import { parseStreamFrame } from "./stream-frame";

describe("parseStreamFrame", () => {
  it("解析 v2 message_delta 信封", () => {
    const frame = parseStreamFrame({
      v: 2,
      type: "message_delta",
      streamId: "s1",
      requestId: "r1",
      seq: 2,
      ts: Date.now(),
      payload: { contentDelta: "hello" },
    });

    expect(frame.contentDelta).toBe("hello");
    expect(frame.streamId).toBe("s1");
    expect(frame.requestId).toBe("r1");
  });

  it("解析 v2 rag_citations 信封", () => {
    const frame = parseStreamFrame({
      v: 2,
      type: "rag_citations",
      ts: Date.now(),
      payload: {
        citations: [
          {
            chunkId: 1,
            documentName: "a.pdf",
            snippet: "text",
            score: 0.8,
          },
        ],
      },
    });

    expect(frame.phase).toBe("rag_citations");
    expect(frame.citations).toHaveLength(1);
  });

  it("兼容旧版扁平 payload", () => {
    const frame = parseStreamFrame({
      thinkingDelta: "think",
      streamId: "legacy",
    });

    expect(frame.thinkingDelta).toBe("think");
    expect(frame.streamId).toBe("legacy");
  });
});
