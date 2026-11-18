import { extractURLPath } from "./tools/url.js";
import { setupAuth } from "./auth/index.js";
import { copyFile } from "./operations/copyFile.js";
import { createDirectory } from "./operations/createDirectory.js";
import { createReadStream, createWriteStream } from "./operations/createStream.js";
import { customRequest } from "./operations/customRequest.js";
import { deleteFile } from "./operations/deleteFile.js";
import { exists } from "./operations/exists.js";
import { getDirectoryContents } from "./operations/directoryContents.js";
import { getFileContents, getFileDownloadLink } from "./operations/getFileContents.js";
import { lock, unlock } from "./operations/lock.js";
import { getQuota } from "./operations/getQuota.js";
import { getStat } from "./operations/stat.js";
import { getSearch } from "./operations/search.js";
import { moveFile } from "./operations/moveFile.js";
import { getFileUploadLink, putFileContents } from "./operations/putFileContents.js";
import { partialUpdateFileContents } from "./operations/partialUpdateFileContents.js";
import { getDAVCompliance } from "./operations/getDAVCompliance.js";
import { AuthType } from "./types.js";
const DEFAULT_CONTACT_HREF = "https://github.com/perry-mitchell/webdav-client/blob/master/LOCK_CONTACT.md";
export function createClient(remoteURL, options = {}) {
    const { authType: authTypeRaw = null, remoteBasePath, contactHref = DEFAULT_CONTACT_HREF, ha1, headers = {}, httpAgent, httpsAgent, password, token, username, withCredentials } = options;
    let authType = authTypeRaw;
    if (!authType) {
        authType = username || password ? AuthType.Password : AuthType.None;
    }
    const context = {
        authType,
        remoteBasePath,
        contactHref,
        ha1,
        headers: Object.assign({}, headers),
        httpAgent,
        httpsAgent,
        password,
        remotePath: extractURLPath(remoteURL),
        remoteURL,
        token,
        username,
        withCredentials
    };
    setupAuth(context, username, password, token, ha1);
    return {
        copyFile: (filename, destination, options) => copyFile(context, filename, destination, options),
        createDirectory: (path, options) => createDirectory(context, path, options),
        createReadStream: (filename, options) => createReadStream(context, filename, options),
        createWriteStream: (filename, options, callback) => createWriteStream(context, filename, options, callback),
        customRequest: (path, requestOptions) => customRequest(context, path, requestOptions),
        deleteFile: (filename, options) => deleteFile(context, filename, options),
        exists: (path, options) => exists(context, path, options),
        getDirectoryContents: (path, options) => getDirectoryContents(context, path, options),
        getFileContents: (filename, options) => getFileContents(context, filename, options),
        getFileDownloadLink: (filename) => getFileDownloadLink(context, filename),
        getFileUploadLink: (filename) => getFileUploadLink(context, filename),
        getHeaders: () => Object.assign({}, context.headers),
        getQuota: (options) => getQuota(context, options),
        lock: (path, options) => lock(context, path, options),
        moveFile: (filename, destinationFilename, options) => moveFile(context, filename, destinationFilename, options),
        putFileContents: (filename, data, options) => putFileContents(context, filename, data, options),
        partialUpdateFileContents: (filePath, start, end, data, options) => partialUpdateFileContents(context, filePath, start, end, data, options),
        getDAVCompliance: (path) => getDAVCompliance(context, path),
        search: (path, options) => getSearch(context, path, options),
        setHeaders: (headers) => {
            context.headers = Object.assign({}, headers);
        },
        stat: (path, options) => getStat(context, path, options),
        unlock: (path, token, options) => unlock(context, path, token, options)
    };
}
