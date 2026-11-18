import { BufferLike, GetFileContentsOptions, ResponseDataDetailed, WebDAVClientContext } from "../types.js";
export declare function getFileContents(context: WebDAVClientContext, filePath: string, options?: GetFileContentsOptions): Promise<BufferLike | string | ResponseDataDetailed<BufferLike | string>>;
export declare function getFileDownloadLink(context: WebDAVClientContext, filePath: string): string;
