import { joinURL } from "../tools/url.js";
import { encodePath, getAllDirectories, normalisePath } from "../tools/path.js";
import { request, prepareRequestOptions } from "../request.js";
import { handleResponseCode } from "../response.js";
import { getStat } from "./stat.js";
export async function createDirectory(context, dirPath, options = {}) {
    if (options.recursive === true)
        return createDirectoryRecursively(context, dirPath, options);
    const requestOptions = prepareRequestOptions({
        url: joinURL(context.remoteURL, ensureCollectionPath(encodePath(dirPath))),
        method: "MKCOL"
    }, context, options);
    const response = await request(requestOptions, context);
    handleResponseCode(context, response);
}
/**
 * Ensure the path is a proper "collection" path by ensuring it has a trailing "/".
 * The proper format of collection according to the specification does contain the trailing slash.
 * http://www.webdav.org/specs/rfc4918.html#rfc.section.5.2
 * @param path Path of the collection
 * @return string Path of the collection with appended trailing "/" in case the `path` does not have it.
 */
function ensureCollectionPath(path) {
    if (!path.endsWith("/")) {
        return path + "/";
    }
    return path;
}
async function createDirectoryRecursively(context, dirPath, options = {}) {
    const paths = getAllDirectories(normalisePath(dirPath));
    paths.sort((a, b) => {
        if (a.length > b.length) {
            return 1;
        }
        else if (b.length > a.length) {
            return -1;
        }
        return 0;
    });
    let creating = false;
    for (const testPath of paths) {
        if (creating) {
            await createDirectory(context, testPath, {
                ...options,
                recursive: false
            });
            continue;
        }
        try {
            const testStat = (await getStat(context, testPath));
            if (testStat.type !== "directory") {
                throw new Error(`Path includes a file: ${dirPath}`);
            }
        }
        catch (err) {
            const error = err;
            if (error.status === 404) {
                creating = true;
                await createDirectory(context, testPath, {
                    ...options,
                    recursive: false
                });
            }
            else {
                throw err;
            }
        }
    }
}
