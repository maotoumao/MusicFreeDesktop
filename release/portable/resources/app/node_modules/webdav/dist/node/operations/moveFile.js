import { joinURL } from "../tools/url.js";
import { encodePath } from "../tools/path.js";
import { request, prepareRequestOptions } from "../request.js";
import { handleResponseCode } from "../response.js";
export async function moveFile(context, filename, destination, options = {}) {
    const requestOptions = prepareRequestOptions({
        url: joinURL(context.remoteURL, encodePath(filename)),
        method: "MOVE",
        headers: {
            Destination: joinURL(context.remoteURL, encodePath(destination)),
            /**
             * From RFC4918 section 10.6: If the overwrite header is not included in a COPY or MOVE request,
             * then the resource MUST treat the request as if it has an overwrite header of value "T".
             *
             * Meaning the overwrite header is always set to "T" EXCEPT the option is explicitly set to false.
             */
            Overwrite: options.overwrite === false ? "F" : "T"
        }
    }, context, options);
    const response = await request(requestOptions, context);
    handleResponseCode(context, response);
}
