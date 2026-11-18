import { joinURL } from "../tools/url.js";
import { encodePath } from "../tools/path.js";
import { request, prepareRequestOptions } from "../request.js";
import { handleResponseCode } from "../response.js";
export async function deleteFile(context, filename, options = {}) {
    const requestOptions = prepareRequestOptions({
        url: joinURL(context.remoteURL, encodePath(filename)),
        method: "DELETE"
    }, context, options);
    const response = await request(requestOptions, context);
    handleResponseCode(context, response);
}
