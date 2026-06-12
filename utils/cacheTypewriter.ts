export interface CacheReplyResult {
  thinking: string;
  response: string;
  fromCache?: boolean;
}

interface TypewriterCallbacks {
  onUpdate: (reply: CacheReplyResult) => void;
  onDone: () => void;
}

/** 根据文本长度计算每帧步进，缓存回放控制在可感知但不拖沓的时长内 */
function calcRevealStep(totalLen: number) {
  if (totalLen <= 0) {
    return { chunk: 1, interval: 0 };
  }

  const maxDuration = totalLen < 80 ? 400 : totalLen < 300 ? 900 : 1600;
  const ticks = Math.min(50, Math.max(6, Math.ceil(totalLen / 8)));
  const interval = Math.max(12, Math.floor(maxDuration / ticks));
  const chunk = Math.max(1, Math.ceil(totalLen / ticks));

  return { chunk, interval };
}

/** 缓存命中时模拟流式输出，避免内容瞬间弹出 */
export function playCacheTypewriter(
  reply: CacheReplyResult,
  { onUpdate, onDone }: TypewriterCallbacks
): () => void {
  const thinking = reply.thinking;
  const response = reply.response;
  const totalLen = thinking.length + response.length;
  const { chunk, interval } = calcRevealStep(totalLen);

  if (totalLen === 0) {
    onUpdate({ ...reply, fromCache: true });
    onDone();
    return () => undefined;
  }

  let cancelled = false;
  let thinkingPos = 0;
  let responsePos = 0;

  const emit = () => {
    onUpdate({
      thinking:
        thinkingPos > 0 ? thinking.slice(0, thinkingPos) : "",
      response: response.slice(0, responsePos),
      fromCache: true,
    });
  };

  const finish = () => {
    onUpdate({
      thinking: thinking || "",
      response,
      fromCache: true,
    });
    onDone();
  };

  const step = () => {
    if (thinkingPos < thinking.length) {
      thinkingPos = Math.min(thinking.length, thinkingPos + chunk);
      return true;
    }
    if (responsePos < response.length) {
      responsePos = Math.min(response.length, responsePos + chunk);
      return true;
    }
    return false;
  };

  const timer = window.setInterval(() => {
    if (cancelled) return;

    if (step()) {
      emit();
      return;
    }

    window.clearInterval(timer);
    finish();
  }, interval);

  // 首帧先吐出一小段，避免长时间「思考中」
  step();
  emit();

  return () => {
    cancelled = true;
    window.clearInterval(timer);
  };
}
