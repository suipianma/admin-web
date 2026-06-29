import type { StreamEvent } from "@/lib/stream/stream-event";

export type StreamRunStatus = "running" | "completed" | "error" | "cancelled";

export interface ToolCallTrace {
  toolCallId: string;
  tool: string;
  step?: number;
  startedAt: number;
  completedAt?: number;
  latencyMs?: number;
  status: "calling" | "done" | "error";
  error?: string;
}

export interface StreamRunTrace {
  streamId: string;
  requestId: string;
  conversationId: number;
  assistantId: number;
  status: StreamRunStatus;
  startedAt: number;
  firstTokenAt?: number;
  completedAt?: number;
  latencyMs?: number;
  ttftMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  toolCalls: ToolCallTrace[];
  lastError?: string;
  eventCount: number;
}

export interface ObservabilityTotals {
  totalRuns: number;
  completedRuns: number;
  errorRuns: number;
  errorRate: number;
  avgLatencyMs: number;
  avgTtftMs: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
}

export interface ObservabilitySnapshot {
  totals: ObservabilityTotals;
  runs: StreamRunTrace[];
  activeRun: StreamRunTrace | null;
  recentEvents: StreamEvent[];
}

const MAX_RUNS = 50;
const MAX_EVENTS = 200;
const STORAGE_KEY = "chat-observability-v1";
const PERSIST_DEBOUNCE_MS = 500;

type StoreListener = () => void;

interface PersistedObservability {
  runs: StreamRunTrace[];
  runOrder: string[];
  recentEvents: StreamEvent[];
}

function emptyTotals(): ObservabilityTotals {
  return {
    totalRuns: 0,
    completedRuns: 0,
    errorRuns: 0,
    errorRate: 0,
    avgLatencyMs: 0,
    avgTtftMs: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
  };
}

function computeTotals(runs: StreamRunTrace[]): ObservabilityTotals {
  const finished = runs.filter(
    (r) => r.status === "completed" || r.status === "error"
  );
  const errorRuns = finished.filter((r) => r.status === "error").length;
  const withLatency = finished.filter((r) => r.latencyMs != null);
  const withTtft = finished.filter((r) => r.ttftMs != null);

  const avgLatencyMs =
    withLatency.length > 0
      ? Math.round(
          withLatency.reduce((sum, r) => sum + (r.latencyMs ?? 0), 0) /
            withLatency.length
        )
      : 0;

  const avgTtftMs =
    withTtft.length > 0
      ? Math.round(
          withTtft.reduce((sum, r) => sum + (r.ttftMs ?? 0), 0) /
            withTtft.length
        )
      : 0;

  return {
    totalRuns: runs.length,
    completedRuns: finished.length - errorRuns,
    errorRuns,
    errorRate:
      finished.length > 0
        ? Math.round((errorRuns / finished.length) * 1000) / 10
        : 0,
    avgLatencyMs,
    avgTtftMs,
    totalPromptTokens: runs.reduce((sum, r) => sum + (r.promptTokens ?? 0), 0),
    totalCompletionTokens: runs.reduce(
      (sum, r) => sum + (r.completionTokens ?? 0),
      0
    ),
  };
}

/** 会话级 Observability 聚合（Debug Panel 数据源） */
class ObservabilityStore {
  private runs = new Map<string, StreamRunTrace>();
  private runOrder: string[] = [];
  private pendingByAssistant = new Map<string, string>();
  private recentEvents: StreamEvent[] = [];
  private listeners = new Set<StoreListener>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.hydrateFromSession();
  }

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): ObservabilitySnapshot {
    const runs = this.runOrder
      .map((id) => this.runs.get(id))
      .filter((r): r is StreamRunTrace => !!r);

    const activeRun =
      [...runs].reverse().find((r) => r.status === "running") ?? null;

    return {
      totals: computeTotals(runs),
      runs,
      activeRun,
      recentEvents: [...this.recentEvents],
    };
  }

  clear(): void {
    this.runs.clear();
    this.runOrder = [];
    this.pendingByAssistant.clear();
    this.recentEvents = [];
    this.persistNow();
    this.notify();
  }

  /** 导出当前快照为 JSON 字符串 */
  exportJson(): string {
    return JSON.stringify(this.getSnapshot(), null, 2);
  }

  ingest(event: StreamEvent): void {
    this.pushEvent(event);

    switch (event.type) {
      case "stream_meta":
        this.ensureRun(event.streamId, {
          conversationId: event.conversationId,
          assistantId: event.assistantId,
          requestId: event.requestId,
        });
        break;
      case "message_delta":
        this.touchRunByAssistant(event.conversationId, event.assistantId, (run) => {
          run.eventCount += 1;
          const now = Date.now();
          if (!run.firstTokenAt && event.reply.response) {
            run.firstTokenAt = now;
            run.ttftMs = now - run.startedAt;
          }
          if (event.reply.promptTokens != null) {
            run.promptTokens = event.reply.promptTokens;
          }
          if (event.reply.completionTokens != null) {
            run.completionTokens = event.reply.completionTokens;
          }
        });
        break;
      case "tool_call":
        this.touchRunByAssistant(event.conversationId, event.assistantId, (run) => {
          const toolCallId =
            event.payload.toolCallId ??
            `${event.conversationId}-${event.assistantId}-${event.payload.tool}-${Date.now()}`;
          run.toolCalls.push({
            toolCallId,
            tool: event.payload.tool,
            step: event.payload.step,
            startedAt: Date.now(),
            status: "calling",
          });
        });
        break;
      case "tool_result":
        this.touchRunByAssistant(event.conversationId, event.assistantId, (run) => {
          const match = [...run.toolCalls]
            .reverse()
            .find(
              (item) =>
                item.status === "calling" &&
                item.tool === event.payload.tool &&
                (event.payload.toolCallId == null ||
                  item.toolCallId === event.payload.toolCallId)
            );
          if (!match) return;
          const now = Date.now();
          match.completedAt = now;
          match.latencyMs = now - match.startedAt;
          match.status = event.payload.error ? "error" : "done";
          match.error = event.payload.error;
        });
        break;
      case "stream_done":
        this.finalizeRun(event.conversationId, "completed");
        break;
      case "stream_cancelled":
        this.finalizeRun(event.conversationId, "cancelled");
        break;
      case "stream_error":
        this.finalizeRun(
          event.conversationId,
          "error",
          event.error.displayMessage
        );
        break;
      default:
        break;
    }

    this.notify();
  }

  private pushEvent(event: StreamEvent): void {
    this.recentEvents.push(event);
    if (this.recentEvents.length > MAX_EVENTS) {
      this.recentEvents.shift();
    }
  }

  private pendingKey(conversationId: number, assistantId: number): string {
    return `${conversationId}:${assistantId}`;
  }

  private ensureRun(
    streamId: string,
    ctx: {
      conversationId: number;
      assistantId: number;
      requestId?: string;
    }
  ): StreamRunTrace {
    const existing = this.runs.get(streamId);
    if (existing) {
      if (ctx.requestId) existing.requestId = ctx.requestId;
      return existing;
    }

    const pendingId = this.pendingByAssistant.get(
      this.pendingKey(ctx.conversationId, ctx.assistantId)
    );
    if (pendingId && pendingId !== streamId) {
      const pending = this.runs.get(pendingId);
      if (pending) {
        this.runs.delete(pendingId);
        this.runOrder = this.runOrder.filter((id) => id !== pendingId);
      }
    }

    const run: StreamRunTrace = {
      streamId,
      requestId: ctx.requestId ?? streamId,
      conversationId: ctx.conversationId,
      assistantId: ctx.assistantId,
      status: "running",
      startedAt: Date.now(),
      toolCalls: [],
      eventCount: 0,
    };

    this.runs.set(streamId, run);
    this.runOrder.push(streamId);
    this.pendingByAssistant.set(
      this.pendingKey(ctx.conversationId, ctx.assistantId),
      streamId
    );

    while (this.runOrder.length > MAX_RUNS) {
      const removed = this.runOrder.shift();
      if (removed) this.runs.delete(removed);
    }

    return run;
  }

  private touchRunByAssistant(
    conversationId: number,
    assistantId: number,
    patch: (run: StreamRunTrace) => void
  ): void {
    const streamId = this.pendingByAssistant.get(
      this.pendingKey(conversationId, assistantId)
    );
    if (!streamId) {
      const tempId = `pending-${conversationId}-${assistantId}`;
      const run = this.ensureRun(tempId, {
        conversationId,
        assistantId,
      });
      patch(run);
      return;
    }
    const run = this.runs.get(streamId);
    if (run) patch(run);
  }

  private finalizeRun(
    conversationId: number,
    status: StreamRunStatus,
    lastError?: string
  ): void {
    const run = [...this.runs.values()]
      .reverse()
      .find(
        (item) =>
          item.conversationId === conversationId && item.status === "running"
      );
    if (!run) return;

    const now = Date.now();
    run.status = status;
    run.completedAt = now;
    run.latencyMs = now - run.startedAt;
    if (lastError) run.lastError = lastError;
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
    this.schedulePersist();
  }

  private hydrateFromSession(): void {
    if (typeof sessionStorage === "undefined") return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as PersistedObservability;
      this.runOrder = Array.isArray(data.runOrder) ? data.runOrder : [];
      this.recentEvents = Array.isArray(data.recentEvents)
        ? data.recentEvents.slice(-MAX_EVENTS)
        : [];
      if (Array.isArray(data.runs)) {
        for (const run of data.runs) {
          if (run?.streamId) this.runs.set(run.streamId, run);
        }
      }
    } catch {
      // 损坏的缓存忽略
    }
  }

  private schedulePersist(): void {
    if (typeof sessionStorage === "undefined") return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistNow();
    }, PERSIST_DEBOUNCE_MS);
  }

  private persistNow(): void {
    if (typeof sessionStorage === "undefined") return;
    try {
      const runs = this.runOrder
        .map((id) => this.runs.get(id))
        .filter((r): r is StreamRunTrace => !!r);
      const payload: PersistedObservability = {
        runs,
        runOrder: [...this.runOrder],
        recentEvents: [...this.recentEvents],
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // quota 超限等忽略
    }
  }
}

export const observabilityStore = new ObservabilityStore();
