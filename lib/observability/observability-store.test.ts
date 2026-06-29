import { describe, expect, it, beforeEach } from "vitest";
import { observabilityStore } from "./observability-store";

describe("observabilityStore", () => {
  beforeEach(() => {
    observabilityStore.clear();
  });

  it("stream_meta 应创建 run 并关联 requestId", () => {
    observabilityStore.ingest({
      type: "stream_meta",
      conversationId: 1,
      assistantId: 10,
      streamId: "stream-a",
      requestId: "req-a",
    });

    const snapshot = observabilityStore.getSnapshot();
    expect(snapshot.activeRun?.requestId).toBe("req-a");
    expect(snapshot.totals.totalRuns).toBe(1);
  });

  it("stream_done 应标记 completed 并计算延迟", () => {
    observabilityStore.ingest({
      type: "stream_meta",
      conversationId: 1,
      assistantId: 10,
      streamId: "stream-b",
      requestId: "req-b",
    });
    observabilityStore.ingest({
      type: "stream_done",
      conversationId: 1,
    });

    const run = observabilityStore
      .getSnapshot()
      .runs.find((item) => item.streamId === "stream-b");
    expect(run?.status).toBe("completed");
    expect(run?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("exportJson 应返回可解析 JSON", () => {
    const json = observabilityStore.exportJson();
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
