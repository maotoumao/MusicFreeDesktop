import { DigestContext, Response } from "../types.js";
export declare function createDigestContext(username: string, password: string, ha1: string): DigestContext;
export declare function generateDigestAuthHeader(options: any, digest: DigestContext): string;
export declare function parseDigestAuth(response: Response, _digest: DigestContext): boolean;
export declare function responseIndicatesDigestAuth(response: Response): boolean;
