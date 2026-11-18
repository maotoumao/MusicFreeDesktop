import { joinURL } from "../tools/url.js";
import { encodePath } from "../tools/path.js";
import { request, prepareRequestOptions } from "../request.js";
import { handleResponseCode } from "../response.js";
export async function getDAVCompliance(context, filePath, options = {}) {
    const requestOptions = prepareRequestOptions({
        url: joinURL(context.remoteURL, encodePath(filePath)),
        method: "OPTIONS"
    }, context, options);
    const response = await request(requestOptions, context);
    try {
        handleResponseCode(context, response);
    }
    catch (err) {
        const error = err;
        throw error;
    }
    const davHeader = response.headers.get("DAV") ?? "";
    const compliance = davHeader.split(",").map(item => item.trim());
    const server = response.headers.get("Server") ?? "";
    return {
        compliance,
        server
    };
}
