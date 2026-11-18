import { XMLParser, XMLBuilder } from "fast-xml-parser";
export function generateLockXML(ownerHREF) {
    return getBuilder().build(namespace({
        lockinfo: {
            "@_xmlns:d": "DAV:",
            lockscope: {
                exclusive: {}
            },
            locktype: {
                write: {}
            },
            owner: {
                href: ownerHREF
            }
        }
    }, "d"));
}
function getBuilder() {
    return new XMLBuilder({
        attributeNamePrefix: "@_",
        format: true,
        ignoreAttributes: false,
        suppressEmptyNode: true
    });
}
function getParser() {
    return new XMLParser({
        removeNSPrefix: true,
        parseAttributeValue: true,
        parseTagValue: true
    });
}
function namespace(obj, ns) {
    const copy = { ...obj };
    for (const key in copy) {
        if (!copy.hasOwnProperty(key)) {
            continue;
        }
        if (copy[key] && typeof copy[key] === "object" && key.indexOf(":") === -1) {
            copy[`${ns}:${key}`] = namespace(copy[key], ns);
            delete copy[key];
        }
        else if (/^@_/.test(key) === false) {
            copy[`${ns}:${key}`] = copy[key];
            delete copy[key];
        }
    }
    return copy;
}
export function parseGenericResponse(xml) {
    return getParser().parse(xml);
}
