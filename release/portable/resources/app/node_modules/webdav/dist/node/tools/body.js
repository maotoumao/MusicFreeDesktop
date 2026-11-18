import Stream from "stream";
import { isArrayBuffer } from "../compat/arrayBuffer.js";
import { isBuffer } from "../compat/buffer.js";
import { isReactNative, isWeb } from "../compat/env.js";
export function requestDataToFetchBody(data) {
    if (!isWeb() && !isReactNative() && data instanceof Stream.Readable) {
        // @ts-ignore
        return [data, {}];
    }
    if (typeof data === "string") {
        return [data, {}];
    }
    else if (isBuffer(data)) {
        return [data, {}];
    }
    else if (isArrayBuffer(data)) {
        return [data, {}];
    }
    else if (data && typeof data === "object") {
        return [
            JSON.stringify(data),
            {
                "content-type": "application/json"
            }
        ];
    }
    throw new Error(`Unable to convert request body: Unexpected body type: ${typeof data}`);
}
