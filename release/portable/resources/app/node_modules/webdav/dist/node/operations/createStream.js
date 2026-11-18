import Stream from "stream";
import { joinURL } from "../tools/url.js";
import { encodePath } from "../tools/path.js";
import { request, prepareRequestOptions } from "../request.js";
import { handleResponseCode } from "../response.js";
const NOOP = () => { };
export function createReadStream(context, filePath, options = {}) {
    const PassThroughStream = Stream.PassThrough;
    const outStream = new PassThroughStream();
    getFileStream(context, filePath, options)
        .then(stream => {
        stream.pipe(outStream);
    })
        .catch(err => {
        outStream.emit("error", err);
    });
    return outStream;
}
export function createWriteStream(context, filePath, options = {}, callback = NOOP) {
    const PassThroughStream = Stream.PassThrough;
    const writeStream = new PassThroughStream();
    const headers = {};
    if (options.overwrite === false) {
        headers["If-None-Match"] = "*";
    }
    const requestOptions = prepareRequestOptions({
        url: joinURL(context.remoteURL, encodePath(filePath)),
        method: "PUT",
        headers,
        data: writeStream,
        maxRedirects: 0
    }, context, options);
    request(requestOptions, context)
        .then(response => handleResponseCode(context, response))
        .then(response => {
        // Fire callback asynchronously to avoid errors
        setTimeout(() => {
            callback(response);
        }, 0);
    })
        .catch(err => {
        writeStream.emit("error", err);
    });
    return writeStream;
}
async function getFileStream(context, filePath, options = {}) {
    const headers = {};
    if (typeof options.range === "object" && typeof options.range.start === "number") {
        let rangeHeader = `bytes=${options.range.start}-`;
        if (typeof options.range.end === "number") {
            rangeHeader = `${rangeHeader}${options.range.end}`;
        }
        headers.Range = rangeHeader;
    }
    const requestOptions = prepareRequestOptions({
        url: joinURL(context.remoteURL, encodePath(filePath)),
        method: "GET",
        headers
    }, context, options);
    const response = await request(requestOptions, context);
    handleResponseCode(context, response);
    if (headers.Range && response.status !== 206) {
        const responseError = new Error(`Invalid response code for partial request: ${response.status}`);
        responseError.status = response.status;
        throw responseError;
    }
    if (options.callback) {
        setTimeout(() => {
            options.callback(response);
        }, 0);
    }
    // @ts-ignore
    return response.body;
}
