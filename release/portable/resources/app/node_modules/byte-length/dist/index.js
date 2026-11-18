"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*
 * Calculate the byte lengths for utf8 encoded strings.
 */
function byteLength(str) {
    if (!str) {
        return 0;
    }
    str = str.toString();
    var len = str.length;
    for (var i = str.length; i--;) {
        var code = str.charCodeAt(i);
        if (0xdc00 <= code && code <= 0xdfff) {
            i--;
        }
        if (0x7f < code && code <= 0x7ff) {
            len++;
        }
        else if (0x7ff < code && code <= 0xffff) {
            len += 2;
        }
    }
    return len;
}
exports.byteLength = byteLength;
//# sourceMappingURL=index.js.map