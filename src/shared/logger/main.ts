import log from "electron-log/main"
import {safeStringify} from "@/common/safe-serialization";


function logError(msg: string, error: Error, extra?: any) {
    log.error(msg, error?.name, error?.message, error?.stack, safeStringify(extra));
}

function logInfo(msg: string, extra?: any) {
    log.info(msg, safeStringify(extra));
}


let firstPerfLogTime = 0;
function logPerf(msg: string) {
    const timestamp = Date.now();
    if (!firstPerfLogTime) {
        firstPerfLogTime = timestamp;
    }
    log.info("[Perf Main]: " + msg + " [Offset]: " + (timestamp - firstPerfLogTime) + "ms");
}

const logger = {
    logInfo,
    logError,
    logPerf
}

export default logger;
