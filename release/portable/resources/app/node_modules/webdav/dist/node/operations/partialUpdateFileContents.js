import { Layerr } from "layerr";
import { joinURL } from "../tools/url.js";
import { encodePath } from "../tools/path.js";
import { request, prepareRequestOptions } from "../request.js";
import { handleResponseCode } from "../response.js";
import { getDAVCompliance } from "./getDAVCompliance.js";
import { ErrorCode } from "../types.js";
export async function partialUpdateFileContents(context, filePath, start, end, data, options = {}) {
    const compliance = await getDAVCompliance(context, filePath, options);
    if (compliance.compliance.includes("sabredav-partialupdate")) {
        return await partialUpdateFileContentsSabredav(context, filePath, start, end, data, options);
    }
    if (compliance.server.includes("Apache") &&
        compliance.compliance.includes("<http://apache.org/dav/propset/fs/1>")) {
        return await partialUpdateFileContentsApache(context, filePath, start, end, data, options);
    }
    throw new Layerr({
        info: {
            code: ErrorCode.NotSupported
        }
    }, "Not supported");
}
async function partialUpdateFileContentsSabredav(context, filePath, start, end, data, options = {}) {
    if (start > end || start < 0) {
        // Actually, SabreDAV support negative start value,
        // Do not support here for compatibility with Apache-style way
        throw new Layerr({
            info: {
                code: ErrorCode.InvalidUpdateRange
            }
        }, `Invalid update range ${start} for partial update`);
    }
    const headers = {
        "Content-Type": "application/x-sabredav-partialupdate",
        "Content-Length": `${end - start + 1}`,
        "X-Update-Range": `bytes=${start}-${end}`
    };
    const requestOptions = prepareRequestOptions({
        url: joinURL(context.remoteURL, encodePath(filePath)),
        method: "PATCH",
        headers,
        data
    }, context, options);
    const response = await request(requestOptions, context);
    handleResponseCode(context, response);
}
async function partialUpdateFileContentsApache(context, filePath, start, end, data, options = {}) {
    if (start > end || start < 0) {
        throw new Layerr({
            info: {
                code: ErrorCode.InvalidUpdateRange
            }
        }, `Invalid update range ${start} for partial update`);
    }
    const headers = {
        "Content-Type": "application/octet-stream",
        "Content-Length": `${end - start + 1}`,
        "Content-Range": `bytes ${start}-${end}/*`
    };
    const requestOptions = prepareRequestOptions({
        url: joinURL(context.remoteURL, encodePath(filePath)),
        method: "PUT",
        headers,
        data
    }, context, options);
    const response = await request(requestOptions, context);
    handleResponseCode(context, response);
}
