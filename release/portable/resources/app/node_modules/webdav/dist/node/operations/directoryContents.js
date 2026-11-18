import pathPosix from "path-posix";
import { joinURL, normaliseHREF } from "../tools/url.js";
import { encodePath, makePathAbsolute, normalisePath } from "../tools/path.js";
import { parseXML, prepareFileFromProps } from "../tools/dav.js";
import { request, prepareRequestOptions } from "../request.js";
import { handleResponseCode, processGlobFilter, processResponsePayload } from "../response.js";
export async function getDirectoryContents(context, remotePath, options = {}) {
    const requestOptions = prepareRequestOptions({
        url: joinURL(context.remoteURL, encodePath(remotePath), "/"),
        method: "PROPFIND",
        headers: {
            Accept: "text/plain,application/xml",
            Depth: options.deep ? "infinity" : "1"
        }
    }, context, options);
    const response = await request(requestOptions, context);
    handleResponseCode(context, response);
    const responseData = await response.text();
    if (!responseData) {
        throw new Error("Failed parsing directory contents: Empty response");
    }
    const davResp = await parseXML(responseData);
    const _remotePath = makePathAbsolute(remotePath);
    const remoteBasePath = makePathAbsolute(context.remoteBasePath || context.remotePath);
    let files = getDirectoryFiles(davResp, remoteBasePath, _remotePath, options.details, options.includeSelf);
    if (options.glob) {
        files = processGlobFilter(files, options.glob);
    }
    return processResponsePayload(response, files, options.details);
}
function getDirectoryFiles(result, serverremoteBasePath, requestPath, isDetailed = false, includeSelf = false) {
    const serverBase = pathPosix.join(serverremoteBasePath, "/");
    // Extract the response items (directory contents)
    const { multistatus: { response: responseItems } } = result;
    // Map all items to a consistent output structure (results)
    const nodes = responseItems.map(item => {
        // HREF is the file path (in full) - The href is already XML entities decoded (e.g. foo&amp;bar is reverted to foo&bar)
        const href = normaliseHREF(item.href);
        // Each item should contain a stat object
        const { propstat: { prop: props } } = item;
        // Process the true full filename (minus the base server path)
        const filename = serverBase === "/"
            ? decodeURIComponent(normalisePath(href))
            : normalisePath(pathPosix.relative(decodeURIComponent(serverBase), decodeURIComponent(href)));
        return prepareFileFromProps(props, filename, isDetailed);
    });
    // If specified, also return the current directory
    if (includeSelf) {
        return nodes;
    }
    // Else, filter out the item pointing to the current directory (not needed)
    return nodes.filter(item => item.basename &&
        (item.type === "file" || item.filename !== requestPath.replace(/\/$/, "")));
}
