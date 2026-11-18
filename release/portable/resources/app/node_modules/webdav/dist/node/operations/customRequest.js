import { joinURL } from "../tools/url.js";
import { encodePath } from "../tools/path.js";
import { request, prepareRequestOptions } from "../request.js";
import { handleResponseCode } from "../response.js";
export async function customRequest(context, remotePath, requestOptions) {
    if (!requestOptions.url) {
        requestOptions.url = joinURL(context.remoteURL, encodePath(remotePath));
    }
    const finalOptions = prepareRequestOptions(requestOptions, context, {});
    const response = await request(finalOptions, context);
    handleResponseCode(context, response);
    return response;
}
