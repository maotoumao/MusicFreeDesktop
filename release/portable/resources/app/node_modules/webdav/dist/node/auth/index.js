import { Layerr } from "layerr";
import { createDigestContext } from "./digest.js";
import { generateBasicAuthHeader } from "./basic.js";
import { generateTokenAuthHeader } from "./oauth.js";
import { AuthType, ErrorCode } from "../types.js";
export function setupAuth(context, username, password, oauthToken, ha1) {
    switch (context.authType) {
        case AuthType.Auto:
            if (username && password) {
                context.headers.Authorization = generateBasicAuthHeader(username, password);
            }
            break;
        case AuthType.Digest:
            context.digest = createDigestContext(username, password, ha1);
            break;
        case AuthType.None:
            // Do nothing
            break;
        case AuthType.Password:
            context.headers.Authorization = generateBasicAuthHeader(username, password);
            break;
        case AuthType.Token:
            context.headers.Authorization = generateTokenAuthHeader(oauthToken);
            break;
        default:
            throw new Layerr({
                info: {
                    code: ErrorCode.InvalidAuthType
                }
            }, `Invalid auth type: ${context.authType}`);
    }
}
