import { PatchFn, PatchOptions } from "./types.js";
interface RegisteredItem<T> {
    original: PatchFn<T>;
    methods: [PatchFn<T>];
    final: boolean;
}
/**
 * Hot patching manager class
 */
export declare class HotPatcher {
    protected _configuration: {
        getEmptyAction: "null" | "throw";
        registry: Record<string, RegisteredItem<unknown>>;
    };
    readonly __type__: string;
    constructor();
    /**
     * Configuration object reference
     * @readonly
     */
    get configuration(): {
        getEmptyAction: "null" | "throw";
        registry: Record<string, RegisteredItem<unknown>>;
    };
    /**
     * The action to take when a non-set method is requested
     * Possible values: null/throw
     */
    get getEmptyAction(): "null" | "throw";
    set getEmptyAction(newAction: "null" | "throw");
    /**
     * Control another hot-patcher instance
     * Force the remote instance to use patched methods from calling instance
     * @param target The target instance to control
     * @param allowTargetOverrides Allow the target to override patched methods on
     * the controller (default is false)
     * @returns Returns self
     * @throws {Error} Throws if the target is invalid
     */
    control(target: HotPatcher, allowTargetOverrides?: boolean): this;
    /**
     * Execute a patched method
     * @param key The method key
     * @param args Arguments to pass to the method (optional)
     * @see HotPatcher#get
     * @returns The output of the called method
     */
    execute<T>(key: string, ...args: Array<any>): T;
    /**
     * Get a method for a key
     * @param key The method key
     * @returns Returns the requested function or null if the function
     * does not exist and the host is configured to return null (and not throw)
     * @throws {Error} Throws if the configuration specifies to throw and the method
     * does not exist
     * @throws {Error} Throws if the `getEmptyAction` value is invalid
     */
    get(key: string): Function | null;
    /**
     * Check if a method has been patched
     * @param key The function key
     * @returns True if already patched
     */
    isPatched(key: string): boolean;
    /**
     * Patch a method name
     * @param key The method key to patch
     * @param method The function to set
     * @param opts Patch options
     * @returns Returns self
     */
    patch<T>(key: string, method: PatchFn<T>, opts?: PatchOptions): this;
    /**
     * Patch a method inline, execute it and return the value
     * Used for patching contents of functions. This method will not apply a patched
     * function if it has already been patched, allowing for external overrides to
     * function. It also means that the function is cached so that it is not
     * instantiated every time the outer function is invoked.
     * @param key The function key to use
     * @param method The function to patch (once, only if not patched)
     * @param args Arguments to pass to the function
     * @returns The output of the patched function
     * @example
     *  function mySpecialFunction(a, b) {
     *      return hotPatcher.patchInline("func", (a, b) => {
     *          return a + b;
     *      }, a, b);
     *  }
     */
    patchInline<T>(key: string, method: PatchFn<T>, ...args: Array<any>): T;
    /**
     * Patch a method (or methods) in sequential-mode
     * See `patch()` with the option `chain: true`
     * @see patch
     * @param key The key to patch
     * @param methods The methods to patch
     * @returns Returns self
     */
    plugin<T>(key: string, ...methods: Array<PatchFn<T>>): this;
    /**
     * Restore a patched method if it has been overridden
     * @param key The method key
     * @returns Returns self
     */
    restore(key: string): this;
    /**
     * Set a method as being final
     * This sets a method as having been finally overridden. Attempts at overriding
     * again will fail with an error.
     * @param key The key to make final
     * @returns Returns self
     */
    setFinal(key: string): this;
}
export {};
