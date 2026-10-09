/**
 * MutationQueue — 串行异步任务队列
 *
 * 用于将多个异步写操作按顺序执行（FIFO），保证并发安全。
 * 典型场景：乐观更新后的持久化回写（musicSheet、playQueue 等）。
 *
 * 当某个任务失败时，清空剩余队列并调用 `onError` 回调，
 * 由上层决定如何恢复状态（如从 DB 重新拉取）。
 */
export default class MutationQueue {
    private queue: Array<() => Promise<void>> = [];
    private flushing = false;
    private errorHandler: ((e: Error) => void) | null = null;

    /**
     * 注册错误回调。任务执行失败时调用，队列随即清空。
     */
    onError(handler: (e: Error) => void): void {
        this.errorHandler = handler;
    }

    /**
     * 入队一个异步任务。如果队列空闲则立即开始执行。
     */
    enqueue(task: () => Promise<void>): void {
        this.queue.push(task);
        if (!this.flushing) {
            this.flush();
        }
    }

    private async flush(): Promise<void> {
        this.flushing = true;
        while (this.queue.length > 0) {
            const task = this.queue.shift()!;
            try {
                await task();
            } catch (e) {
                this.queue = [];
                this.errorHandler?.(e instanceof Error ? e : new Error(String(e)));
                break;
            }
        }
        this.flushing = false;
    }
}
