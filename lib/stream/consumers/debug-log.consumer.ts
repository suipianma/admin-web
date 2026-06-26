import type { StreamEvent } from "../stream-event";

const DEBUG_BUFFER_SIZE = 200;

const debugBuffer: StreamEvent[] = [];

/** Debug Panel 环形缓冲（stub） */
export function handleDebugLogEvent(event: StreamEvent): void {
  debugBuffer.push(event);
  if (debugBuffer.length > DEBUG_BUFFER_SIZE) {
    debugBuffer.shift();
  }
}

/** 供未来 Debug Panel 读取最近事件 */
export function getStreamDebugLog(): readonly StreamEvent[] {
  return debugBuffer;
}

export function clearStreamDebugLog(): void {
  debugBuffer.length = 0;
}
