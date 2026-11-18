import { DAVCompliance, WebDAVClientContext, WebDAVMethodOptions } from "../types.js";
export declare function getDAVCompliance(context: WebDAVClientContext, filePath: string, options?: WebDAVMethodOptions): Promise<DAVCompliance>;
