import { MoveFileOptions, WebDAVClientContext } from "../types.js";
export declare function moveFile(context: WebDAVClientContext, filename: string, destination: string, options?: MoveFileOptions): Promise<void>;
