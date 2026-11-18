import { PatchFn } from "./types.js";
export declare function sequence<T>(...methods: Array<PatchFn<T>>): (...args: Array<any>) => T;
