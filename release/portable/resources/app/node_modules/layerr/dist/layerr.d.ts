import { LayerrInfo, LayerrOptions } from "./types.js";
export declare class Layerr extends Error {
    _cause?: Error;
    _info?: LayerrInfo;
    constructor(errorOptionsOrMessage?: LayerrOptions | string | Error, messageText?: string);
    static cause(err: Layerr | Error): Layerr | Error | null;
    static fullStack(err: Layerr | Error): string;
    static info(err: Layerr | Error): LayerrInfo;
    cause(): Error | Layerr | null;
    toString(): string;
}
