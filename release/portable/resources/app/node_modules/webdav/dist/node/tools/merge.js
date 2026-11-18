export function cloneShallow(obj) {
    return isPlainObject(obj)
        ? Object.assign({}, obj)
        : Object.setPrototypeOf(Object.assign({}, obj), Object.getPrototypeOf(obj));
}
function isPlainObject(obj) {
    if (typeof obj !== "object" ||
        obj === null ||
        Object.prototype.toString.call(obj) != "[object Object]") {
        // Not an object
        return false;
    }
    if (Object.getPrototypeOf(obj) === null) {
        return true;
    }
    let proto = obj;
    // Find the prototype
    while (Object.getPrototypeOf(proto) !== null) {
        proto = Object.getPrototypeOf(proto);
    }
    return Object.getPrototypeOf(obj) === proto;
}
export function merge(...args) {
    let output = null, items = [...args];
    while (items.length > 0) {
        const nextItem = items.shift();
        if (!output) {
            output = cloneShallow(nextItem);
        }
        else {
            output = mergeObjects(output, nextItem);
        }
    }
    return output;
}
function mergeObjects(obj1, obj2) {
    const output = cloneShallow(obj1);
    Object.keys(obj2).forEach(key => {
        if (!output.hasOwnProperty(key)) {
            output[key] = obj2[key];
            return;
        }
        if (Array.isArray(obj2[key])) {
            output[key] = Array.isArray(output[key])
                ? [...output[key], ...obj2[key]]
                : [...obj2[key]];
        }
        else if (typeof obj2[key] === "object" && !!obj2[key]) {
            output[key] =
                typeof output[key] === "object" && !!output[key]
                    ? mergeObjects(output[key], obj2[key])
                    : cloneShallow(obj2[key]);
        }
        else {
            output[key] = obj2[key];
        }
    });
    return output;
}
