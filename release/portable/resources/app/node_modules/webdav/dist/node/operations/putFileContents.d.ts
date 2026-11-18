/// <reference types="node" />
import Stream from "stream";
import { BufferLike, PutFileContentsOptions, WebDAVClientContext } from "../types.js";
export declare function putFileContents(context: WebDAVClientContext, filePath: string, data: string | BufferLike | Stream.Readable, options?: PutFileContentsOptions): Promise<boolean>;
export declare function getFileUploadLink(context: WebDAVClientContext, filePath: string): string;
