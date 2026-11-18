import { CopyFileOptions, WebDAVClientContext } from "../types.js";
export declare function copyFile(context: WebDAVClientContext, filename: string, destination: string, options?: CopyFileOptions): Promise<void>;
