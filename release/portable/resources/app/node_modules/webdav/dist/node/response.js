import minimatch from "minimatch";
import { convertResponseHeaders } from "./tools/headers.js";
export function createErrorFromResponse(response, prefix = "") {
    const err = new Error(`${prefix}Invalid response: ${response.status} ${response.statusText}`);
    err.status = response.status;
    err.response = response;
    return err;
}
export function handleResponseCode(context, response) {
    const { status } = response;
    if (status === 401 && context.digest)
        return response;
    if (status >= 400) {
        const err = createErrorFromResponse(response);
        throw err;
    }
    return response;
}
export function processGlobFilter(files, glob) {
    return files.filter(file => minimatch(file.filename, glob, { matchBase: true }));
}
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
export function processResponsePayload(response, data, isDetailed = false) {
    return isDetailed
        ? {
            data,
            headers: response.headers ? convertResponseHeaders(response.headers) : {},
            status: response.status,
            statusText: response.statusText
        }
        : data;
}
