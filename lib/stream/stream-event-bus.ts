import type { StreamEvent, StreamEventHandler } from "./stream-event";

/** 轻量同步事件总线：StreamAdapter 解析后统一 emit，多消费者订阅 */
export class StreamEventBus {
  private readonly handlers = new Set<StreamEventHandler>();

  subscribe(handler: StreamEventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  emit(event: StreamEvent): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
