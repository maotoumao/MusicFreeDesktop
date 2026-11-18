import { toBase64 } from "../tools/encode.js";
export function generateBasicAuthHeader(username, password) {
    const encoded = toBase64(`${username}:${password}`);
    return `Basic ${encoded}`;
}
