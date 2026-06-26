type QueueTask<T> = {
  id: string;
  run: () => Promise<T> | T;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

/** 并发限制 + FIFO 队列 */
export class RequestQueue {
  private active = 0;
  private readonly queue: QueueTask<unknown>[] = [];

  constructor(private readonly maxConcurrent = 2) {}

  run<T>(id: string, task: () => Promise<T> | T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id,
        run: task,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      void this.drain();
    });
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get activeCount(): number {
    return this.active;
  }

  private async drain(): Promise<void> {
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) return;
      this.active += 1;
      try {
        const result = await item.run();
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      } finally {
        this.active -= 1;
        void this.drain();
      }
    }
  }
}
