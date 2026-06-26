import type { AgentStepItem } from "@/components/chat/ChatMessageItem";
import type { ChatStreamConsumerDeps } from "./types";
import type { StreamEvent } from "../stream-event";

function toAgentStepItem(
  payload: Extract<StreamEvent, { type: "agent_step" }>["payload"]
): AgentStepItem {
  if (payload.phase === "agent_start") {
    return { type: "start", maxSteps: payload.maxSteps };
  }
  if (payload.phase === "agent_step") {
    return {
      type: "step",
      step: payload.step,
      maxSteps: payload.maxSteps,
    };
  }
  return { type: "done", totalSteps: payload.steps };
}

/** Agent 时间线步骤 */
export function handleAgentTimelineEvent(
  event: StreamEvent,
  deps: ChatStreamConsumerDeps
): void {
  if (event.type !== "agent_step") return;

  const { conversationId, assistantId, payload } = event;
  const item = toAgentStepItem(payload);

  if (!deps.isViewingConversation(conversationId)) {
    deps.mutateDraftMessages(conversationId, (msgs) =>
      msgs.map((m) =>
        m.id === assistantId
          ? { ...m, agentSteps: [...(m.agentSteps ?? []), item] }
          : m
      )
    );
    return;
  }
  deps.appendAgentStep(assistantId, item);
}
