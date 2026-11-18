import URL from "url-parse";
import { Layerr } from "layerr";
import _joinURL from "url-join";
import { normalisePath } from "./path.js";
export function extractURLPath(fullURL) {
    const url = new URL(fullURL);
    let urlPath = url.pathname;
    if (urlPath.length <= 0) {
        urlPath = "/";
    }
    return normalisePath(urlPath);
}
export function joinURL(...parts) {
    return _joinURL(parts.reduce((output, nextPart, partIndex) => {
        if (partIndex === 0 ||
            nextPart !== "/" ||
            (nextPart === "/" && output[output.length - 1] !== "/")) {
            output.push(nextPart);
        }
        return output;
    }, []));
}
export function normaliseHREF(href) {
    try {
        const normalisedHref = href.replace(/^https?:\/\/[^\/]+/, "");
        return normalisedHref;
    }
    catch (err) {
        throw new Layerr(err, "Failed normalising HREF");
    }
}
