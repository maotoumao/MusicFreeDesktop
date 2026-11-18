import nestedProp from "nested-property";
import { joinURL } from "../tools/url.js";
import { encodePath } from "../tools/path.js";
import { generateLockXML, parseGenericResponse } from "../tools/xml.js";
import { request, prepareRequestOptions } from "../request.js";
import { createErrorFromResponse, handleResponseCode } from "../response.js";
const DEFAULT_TIMEOUT = "Infinite, Second-4100000000";
export async function lock(context, path, options = {}) {
    const { refreshToken, timeout = DEFAULT_TIMEOUT } = options;
    const headers = {
        Accept: "text/plain,application/xml",
        Timeout: timeout
    };
    if (refreshToken) {
        headers.If = refreshToken;
    }
    const requestOptions = prepareRequestOptions({
        url: joinURL(context.remoteURL, encodePath(path)),
        method: "LOCK",
        headers,
        data: generateLockXML(context.contactHref)
    }, context, options);
    const response = await request(requestOptions, context);
    handleResponseCode(context, response);
    const responseData = await response.text();
    const lockPayload = parseGenericResponse(responseData);
    const token = nestedProp.get(lockPayload, "prop.lockdiscovery.activelock.locktoken.href");
    const serverTimeout = nestedProp.get(lockPayload, "prop.lockdiscovery.activelock.timeout");
    if (!token) {
        const err = createErrorFromResponse(response, "No lock token received: ");
        throw err;
    }
    return {
        token,
        serverTimeout
    };
}
export async function unlock(context, path, token, options = {}) {
    const requestOptions = prepareRequestOptions({
        url: joinURL(context.remoteURL, encodePath(path)),
        method: "UNLOCK",
        headers: {
            "Lock-Token": token
        }
    }, context, options);
    const response = await request(requestOptions, context);
    handleResponseCode(context, response);
    if (response.status !== 204 && response.status !== 200) {
        const err = createErrorFromResponse(response);
        throw err;
    }
}
