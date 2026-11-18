export type PatchFn<T> = (...args: Array<unknown>) => T;
export interface PatchOptions {
    /**
     * Whether or not to allow chaining execution. Chained
     *  execution allows for attaching multiple callbacks to a key, where the callbacks
     *  will be executed in order of when they were patched (oldest to newest), the
     *  values being passed from one method to another.
     */
    chain?: boolean;
}
