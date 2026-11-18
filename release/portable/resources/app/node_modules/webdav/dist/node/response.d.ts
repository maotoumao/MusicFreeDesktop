import { FileStat, Response, ResponseDataDetailed, WebDAVClientContext } from "./types.js";
export declare function createErrorFromResponse(response: Response, prefix?: string): Error;
export declare function handleResponseCode(context: WebDAVClientContext, response: Response): Response;
export declare function processGlobFilter(files: Array<FileStat>, glob: string): Array<FileStat>;
/**
 * Process a response payload (eg. from `customRequest`) and
 *  prepare it for further processing. Exposed for custom
 *  request handling.
 * @param response The response for a request
 * @param data The data returned
 * @param isDetailed Whether or not a detailed result is
 *  requested
 * @returns The response data, or a detailed response object
 *  if required
 */
export declare function processResponsePayload<T>(response: Response, data: T, isDetailed?: boolean): ResponseDataDetailed<T> | T;
