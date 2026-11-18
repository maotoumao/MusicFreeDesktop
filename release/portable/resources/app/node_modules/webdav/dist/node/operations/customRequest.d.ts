import { RequestOptionsCustom, Response, WebDAVClientContext } from "../types.js";
export declare function customRequest(context: WebDAVClientContext, remotePath: string, requestOptions: RequestOptionsCustom): Promise<Response>;
