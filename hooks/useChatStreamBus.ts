import { useCallback, useEffect, useRef } from "react";
import {
  StreamEventBus,
  createStreamBusHandlers,
  dispatchStreamEvent,
} from "@/lib/stream";
import type { ChatStreamConsumerDeps } from "@/lib/stream";
import type { StreamBusHandlerContext } from "@/lib/stream";

/** 聊天页 Stream Event Bus：订阅消费者 + 生成 StreamHandlers */
export function useChatStreamBus(deps: ChatStreamConsumerDeps) {
  const busRef = useRef<StreamEventBus | null>(null);
  if (!busRef.current) {
    busRef.current = new StreamEventBus();
  }

  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    const bus = busRef.current!;
    return bus.subscribe((event) => {
      dispatchStreamEvent(event, depsRef.current);
    });
  }, []);

  const createHandlers = useCallback(
    (ctx: StreamBusHandlerContext) =>
      createStreamBusHandlers(busRef.current!, ctx),
    []
  );

  return { createHandlers };
}
