import { parseSearch, parseXML } from "../tools/dav.js";
import { joinURL } from "../tools/url.js";
import { encodePath } from "../tools/path.js";
import { request, prepareRequestOptions } from "../request.js";
import { handleResponseCode, processResponsePayload } from "../response.js";
export async function getSearch(context, searchArbiter, options = {}) {
    const { details: isDetailed = false } = options;
    const requestOptions = prepareRequestOptions({
        url: joinURL(context.remoteURL, encodePath(searchArbiter)),
        method: "SEARCH",
        headers: {
            Accept: "text/plain,application/xml",
            // Ensure a Content-Type header is set was this is required by e.g. sabre/dav
            "Content-Type": context.headers["Content-Type"] || "application/xml; charset=utf-8"
        }
    }, context, options);
    const response = await request(requestOptions, context);
    handleResponseCode(context, response);
    const responseText = await response.text();
    const responseData = await parseXML(responseText);
    const results = parseSearch(responseData, searchArbiter, isDetailed);
    return processResponsePayload(response, results, isDetailed);
}
