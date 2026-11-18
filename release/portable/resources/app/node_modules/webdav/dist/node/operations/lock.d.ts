import { LockOptions, LockResponse, WebDAVClientContext, WebDAVMethodOptions } from "../types.js";
export declare function lock(context: WebDAVClientContext, path: string, options?: LockOptions): Promise<LockResponse>;
export declare function unlock(context: WebDAVClientContext, path: string, token: string, options?: WebDAVMethodOptions): Promise<void>;
