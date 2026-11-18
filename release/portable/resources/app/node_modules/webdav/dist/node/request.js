import { Agent as HTTPAgent } from "http";
import { Agent as HTTPSAgent } from "https";
import { fetch } from "@buttercup/fetch";
import { getPatcher } from "./compat/patcher.js";
import { isReactNative, isWeb } from "./compat/env.js";
import { generateDigestAuthHeader, parseDigestAuth, responseIndicatesDigestAuth } from "./auth/digest.js";
import { cloneShallow, merge } from "./tools/merge.js";
import { mergeHeaders } from "./tools/headers.js";
import { requestDataToFetchBody } from "./tools/body.js";
import { AuthType } from "./types.js";
import { setupAuth } from "./auth/index.js";
function getFetchOptions(requestOptions) {
    let headers = {};
    // Handle standard options
    const opts = {
        method: requestOptions.method
    };
    if (requestOptions.headers) {
        headers = mergeHeaders(headers, requestOptions.headers);
    }
    if (typeof requestOptions.data !== "undefined") {
        const [body, newHeaders] = requestDataToFetchBody(requestOptions.data);
        opts.body = body;
        headers = mergeHeaders(headers, newHeaders);
    }
    if (requestOptions.signal) {
        opts.signal = requestOptions.signal;
    }
    if (requestOptions.withCredentials) {
        opts.credentials = "include";
    }
    // Check for node-specific options
    if (!isWeb() && !isReactNative()) {
        if (requestOptions.httpAgent || requestOptions.httpsAgent) {
            opts.agent = (parsedURL) => {
                if (parsedURL.protocol === "http:") {
                    return requestOptions.httpAgent || new HTTPAgent();
                }
                return requestOptions.httpsAgent || new HTTPSAgent();
            };
        }
    }
    // Attach headers
    opts.headers = headers;
    return opts;
}
export function prepareRequestOptions(requestOptions, context, userOptions) {
    const finalOptions = cloneShallow(requestOptions);
    finalOptions.headers = mergeHeaders(context.headers, finalOptions.headers || {}, userOptions.headers || {});
    if (typeof userOptions.data !== "undefined") {
        finalOptions.data = userOptions.data;
    }
    if (userOptions.signal) {
        finalOptions.signal = userOptions.signal;
    }
    if (context.httpAgent) {
        finalOptions.httpAgent = context.httpAgent;
    }
    if (context.httpsAgent) {
        finalOptions.httpsAgent = context.httpsAgent;
    }
    if (context.digest) {
        finalOptions._digest = context.digest;
    }
    if (typeof context.withCredentials === "boolean") {
        finalOptions.withCredentials = context.withCredentials;
    }
    return finalOptions;
}
export async function request(requestOptions, context) {
    if (context.authType === AuthType.Auto) {
        return requestAuto(requestOptions, context);
    }
    if (requestOptions._digest) {
        return requestDigest(requestOptions);
    }
    return requestStandard(requestOptions);
}
async function requestAuto(requestOptions, context) {
    const response = await requestStandard(requestOptions);
    if (response.ok) {
        context.authType = AuthType.Password;
        return response;
    }
    if (response.status == 401 && responseIndicatesDigestAuth(response)) {
        context.authType = AuthType.Digest;
        setupAuth(context, context.username, context.password, undefined, undefined);
        requestOptions._digest = context.digest;
        return requestDigest(requestOptions);
    }
    return response;
}
async function requestDigest(requestOptions) {
    // Remove client's digest authentication object from request options
    const _digest = requestOptions._digest;
    delete requestOptions._digest;
    // If client is already using digest authentication, include the digest authorization header
    if (_digest.hasDigestAuth) {
        requestOptions = merge(requestOptions, {
            headers: {
                Authorization: generateDigestAuthHeader(requestOptions, _digest)
            }
        });
    }
    // Perform digest request + check
    const response = await requestStandard(requestOptions);
    if (response.status == 401) {
        _digest.hasDigestAuth = parseDigestAuth(response, _digest);
        if (_digest.hasDigestAuth) {
            requestOptions = merge(requestOptions, {
                headers: {
                    Authorization: generateDigestAuthHeader(requestOptions, _digest)
                }
            });
            const response2 = await requestStandard(requestOptions);
            if (response2.status == 401) {
                _digest.hasDigestAuth = false;
            }
            else {
                _digest.nc++;
            }
            return response2;
        }
    }
    else {
        _digest.nc++;
    }
    return response;
}
function requestStandard(requestOptions) {
    const patcher = getPatcher();
    return patcher.patchInline("request", (options) => patcher.patchInline("fetch", fetch, options.url, getFetchOptions(options)), requestOptions);
}
