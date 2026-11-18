import { RequestOptionsCustom, RequestOptionsWithState, Response, WebDAVClientContext, WebDAVMethodOptions } from "./types.js";
export declare function prepareRequestOptions(requestOptions: RequestOptionsCustom | RequestOptionsWithState, context: WebDAVClientContext, userOptions: WebDAVMethodOptions): RequestOptionsWithState;
export declare function request(requestOptions: RequestOptionsWithState, context: WebDAVClientContext): Promise<Response>;
