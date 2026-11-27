/**
 * MutationQueue — 串行异步任务队列
 *
 * 用于将多个异步写操作按顺序执行（FIFO），保证并发安全。
 * 典型场景：乐观更新后的持久化回写（playlist、playQueue 等）。
 *
 * 当某个任务失败时，清空剩余队列并调用 `onError` 回调，
 * 由上层决定如何恢复状态（如从 DB 重新拉取）。
 */
export default class MutationQueue {
    private queue: Array<{ run: () => Promise<void>; reject: (e: Error) => void }> = [];
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
     * 返回该任务的结果；任务失败、或因前面的任务失败被清出队列时 reject。
     * 不关心结果的调用方可以忽略返回值，失败统一由 onError 处理。
     */
    enqueue<T>(task: () => Promise<T>): Promise<T> {
        const result = new Promise<T>((resolve, reject) => {
            this.queue.push({ run: () => task().then(resolve), reject });
        });
        // 调用方不等待结果时，不产生未处理的 rejection
        result.catch(() => {});
        if (!this.flushing) {
            this.flush();
        }
        return result;
    }

    private async flush(): Promise<void> {
        this.flushing = true;
        while (this.queue.length > 0) {
            const task = this.queue.shift()!;
            try {
                await task.run();
            } catch (e) {
                const error = e instanceof Error ? e : new Error(String(e));
                const dropped = this.queue;
                this.queue = [];
                task.reject(error);
                for (const item of dropped) item.reject(error);
                this.errorHandler?.(error);
                break;
            }
        }
        this.flushing = false;
    }
}
