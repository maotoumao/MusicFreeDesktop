import { CreateDirectoryOptions, WebDAVClientContext } from "../types.js";
export declare function createDirectory(context: WebDAVClientContext, dirPath: string, options?: CreateDirectoryOptions): Promise<void>;
