import { Queue, RunFunction } from './queue.js';
import { QueueAddOptions } from './options.js';
export interface PriorityQueueOptions extends QueueAddOptions {
    priority?: number;
}
export default class PriorityQueue implements Queue<RunFunction, PriorityQueueOptions> {
    #private;
    enqueue(run: RunFunction, options?: Partial<PriorityQueueOptions>): void;
    dequeue(): RunFunction | undefined;
    filter(options: Readonly<Partial<PriorityQueueOptions>>): RunFunction[];
    get size(): number;
}
