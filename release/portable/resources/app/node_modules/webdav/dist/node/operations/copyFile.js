import { joinURL } from "../tools/url.js";
import { encodePath } from "../tools/path.js";
import { request, prepareRequestOptions } from "../request.js";
import { handleResponseCode } from "../response.js";
export async function copyFile(context, filename, destination, options = {}) {
    const requestOptions = prepareRequestOptions({
        url: joinURL(context.remoteURL, encodePath(filename)),
        method: "COPY",
        headers: {
            Destination: joinURL(context.remoteURL, encodePath(destination)),
            /**
             * From RFC4918 section 10.6: If the overwrite header is not included in a COPY or MOVE request,
             * then the resource MUST treat the request as if it has an overwrite header of value "T".
             *
             * Meaning the overwrite header is always set to "T" EXCEPT the option is explicitly set to false.
             */
            Overwrite: options.overwrite === false ? "F" : "T",
            /**
             * From RFC4918 section 9.8.3: A client may submit a Depth header on a COPY on a collection with a value of "0"
             * or "infinity". The COPY method on a collection without a Depth header MUST act as if
             * a Depth header with value "infinity" was included.
             */
            Depth: options.shallow ? "0" : "infinity"
        }
    }, context, options);
    const response = await request(requestOptions, context);
    handleResponseCode(context, response);
}
