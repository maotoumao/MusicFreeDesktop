import md5 from "md5";
export function ha1Compute(algorithm, user, realm, pass, nonce, cnonce, ha1) {
    const ha1Hash = ha1 || md5(`${user}:${realm}:${pass}`);
    if (algorithm && algorithm.toLowerCase() === "md5-sess") {
        return md5(`${ha1Hash}:${nonce}:${cnonce}`);
    }
    return ha1Hash;
}
