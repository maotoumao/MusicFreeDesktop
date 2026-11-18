/// <reference types="node" />
import Stream from "stream";
import { CreateReadStreamOptions, CreateWriteStreamCallback, CreateWriteStreamOptions, WebDAVClientContext } from "../types.js";
export declare function createReadStream(context: WebDAVClientContext, filePath: string, options?: CreateReadStreamOptions): Stream.Readable;
export declare function createWriteStream(context: WebDAVClientContext, filePath: string, options?: CreateWriteStreamOptions, callback?: CreateWriteStreamCallback): Stream.Writable;
