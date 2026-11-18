import { EventEmitter } from 'eventemitter3';
import { Queue, RunFunction } from './queue.js';
import PriorityQueue from './priority-queue.js';
import { QueueAddOptions, Options, TaskOptions } from './options.js';
type Task<TaskResultType> = ((options: TaskOptions) => PromiseLike<TaskResultType>) | ((options: TaskOptions) => TaskResultType);
/**
The error thrown by `queue.add()` when a job is aborted before it is run. See `signal`.
*/
export declare class AbortError extends Error {
}
type EventName = 'active' | 'idle' | 'empty' | 'add' | 'next' | 'completed' | 'error';
/**
Promise queue with concurrency control.
*/
export default class PQueue<QueueType extends Queue<RunFunction, EnqueueOptionsType> = PriorityQueue, EnqueueOptionsType extends QueueAddOptions = QueueAddOptions> extends EventEmitter<EventName> {
    #private;
    /**
    Per-operation timeout in milliseconds. Operations fulfill once `timeout` elapses if they haven't already.

    Applies to each future operation.
    */
    timeout?: number;
    constructor(options?: Options<QueueType, EnqueueOptionsType>);
    get concurrency(): number;
    set concurrency(newConcurrency: number);
    /**
    Adds a sync or async task to the queue. Always returns a promise.
    */
    add<TaskResultType>(function_: Task<TaskResultType>, options: {
        throwOnTimeout: true;
    } & Exclude<EnqueueOptionsType, 'throwOnTimeout'>): Promise<TaskResultType>;
    add<TaskResultType>(function_: Task<TaskResultType>, options?: Partial<EnqueueOptionsType>): Promise<TaskResultType | void>;
    /**
    Same as `.add()`, but accepts an array of sync or async functions.

    @returns A promise that resolves when all functions are resolved.
    */
    addAll<TaskResultsType>(functions: ReadonlyArray<Task<TaskResultsType>>, options?: {
        throwOnTimeout: true;
    } & Partial<Exclude<EnqueueOptionsType, 'throwOnTimeout'>>): Promise<TaskResultsType[]>;
    addAll<TaskResultsType>(functions: ReadonlyArray<Task<TaskResultsType>>, options?: Partial<EnqueueOptionsType>): Promise<Array<TaskResultsType | void>>;
    /**
    Start (or resume) executing enqueued tasks within concurrency limit. No need to call this if queue is not paused (via `options.autoStart = false` or by `.pause()` method.)
    */
    start(): this;
    /**
    Put queue execution on hold.
    */
    pause(): void;
    /**
    Clear the queue.
    */
    clear(): void;
    /**
    Can be called multiple times. Useful if you for example add additional items at a later time.

    @returns A promise that settles when the queue becomes empty.
    */
    onEmpty(): Promise<void>;
    /**
    @returns A promise that settles when the queue size is less than the given limit: `queue.size < limit`.

    If you want to avoid having the queue grow beyond a certain size you can `await queue.onSizeLessThan()` before adding a new item.

    Note that this only limits the number of items waiting to start. There could still be up to `concurrency` jobs already running that this call does not include in its calculation.
    */
    onSizeLessThan(limit: number): Promise<void>;
    /**
    The difference with `.onEmpty` is that `.onIdle` guarantees that all work from the queue has finished. `.onEmpty` merely signals that the queue is empty, but it could mean that some promises haven't completed yet.

    @returns A promise that settles when the queue becomes empty, and all promises have completed; `queue.size === 0 && queue.pending === 0`.
    */
    onIdle(): Promise<void>;
    /**
    Size of the queue, the number of queued items waiting to run.
    */
    get size(): number;
    /**
    Size of the queue, filtered by the given options.

    For example, this can be used to find the number of items remaining in the queue with a specific priority level.
    */
    sizeBy(options: Readonly<Partial<EnqueueOptionsType>>): number;
    /**
    Number of running items (no longer in the queue).
    */
    get pending(): number;
    /**
    Whether the queue is currently paused.
    */
    get isPaused(): boolean;
}
export { Queue, QueueAddOptions, QueueAddOptions as DefaultAddOptions, Options };
