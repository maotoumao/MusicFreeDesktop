import { Layerr } from "layerr";
import { byteLength } from "byte-length";
import { isArrayBuffer } from "../compat/arrayBuffer.js";
import { isBuffer } from "../compat/buffer.js";
import { ErrorCode } from "../types.js";
export function calculateDataLength(data) {
    if (isArrayBuffer(data)) {
        return data.byteLength;
    }
    else if (isBuffer(data)) {
        return data.length;
    }
    else if (typeof data === "string") {
        return byteLength(data);
    }
    throw new Layerr({
        info: {
            code: ErrorCode.DataTypeNoLength
        }
    }, "Cannot calculate data length: Invalid type");
}
