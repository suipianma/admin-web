import type { ChatStreamConsumerDeps } from "./types";
import type { StreamEvent } from "../stream-event";

/** 流生命周期：meta / done / error */
export function handleStreamLifecycleEvent(
  event: StreamEvent,
  deps: ChatStreamConsumerDeps
): void {
  if (event.type === "stream_meta") {
    deps.streamIdsRef.current.set(event.conversationId, event.streamId);
    deps.saveActiveStream(event.conversationId, event.streamId);
    return;
  }

  if (event.type === "stream_done") {
    deps.streamStopsRef.current.delete(event.conversationId);
    deps.finishStreamForConversation(event.conversationId);
    return;
  }

  if (event.type === "stream_error") {
    const { conversationId, error, rollback } = event;
    deps.streamStopsRef.current.delete(conversationId);

    if (deps.isViewingConversation(conversationId)) {
      deps.cancelStream();
      deps.resetStream();
      const shouldRollback =
        rollback?.userMsgId != null && rollback.assistantId != null;
      if (shouldRollback) {
        deps.removeMessages([rollback!.userMsgId!, rollback!.assistantId!]);
      } else {
        void deps.syncFromServer(conversationId);
      }
    }
    deps.clearStreamingState(conversationId);

    const errMsg = error.displayMessage;
    if (errMsg.includes("已达上限")) {
      deps.message.warning(deps.limitErrorMsg);
    } else if (deps.isViewingConversation(conversationId)) {
      deps.message.error(errMsg);
    }
  }
}
