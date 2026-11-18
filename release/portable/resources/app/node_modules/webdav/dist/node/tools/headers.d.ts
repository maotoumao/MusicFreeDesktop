import { Headers } from "@buttercup/fetch";
import { Headers as HeadersSimple } from "../types.js";
export declare function convertResponseHeaders(headers: Headers): HeadersSimple;
export declare function mergeHeaders(...headerPayloads: HeadersSimple[]): HeadersSimple;
