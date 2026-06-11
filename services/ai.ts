const API_BASE = "http://localhost:3000";

// SSE 流式聊天，逐字回调
export function streamChat(
  onChunk: (char: string) => void,
  onDone: () => void
) {
  const eventSource = new EventSource(`${API_BASE}/ai/chat`);
  let finished = false;

  eventSource.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      onChunk(parsed.data ?? event.data);
    } catch {
      onChunk(event.data);
    }
  };

  // NestJS SSE 结束时 EventSource 会触发 onerror
  eventSource.onerror = () => {
    eventSource.close();
    if (!finished) {
      finished = true;
      onDone();
    }
  };

  return () => {
    finished = true;
    eventSource.close();
  };
}
