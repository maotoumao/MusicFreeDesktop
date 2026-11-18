import { prepareRequestOptions, request } from "../request.js";
import { handleResponseCode, processResponsePayload } from "../response.js";
import { parseXML } from "../tools/dav.js";
import { joinURL } from "../tools/url.js";
import { parseQuota } from "../tools/quota.js";
export async function getQuota(context, options = {}) {
    const path = options.path || "/";
    const requestOptions = prepareRequestOptions({
        url: joinURL(context.remoteURL, path),
        method: "PROPFIND",
        headers: {
            Accept: "text/plain,application/xml",
            Depth: "0"
        }
    }, context, options);
    const response = await request(requestOptions, context);
    handleResponseCode(context, response);
    const responseData = await response.text();
    const result = await parseXML(responseData);
    const quota = parseQuota(result);
    return processResponsePayload(response, quota, options.details);
}
