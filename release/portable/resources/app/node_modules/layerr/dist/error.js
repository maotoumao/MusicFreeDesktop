export function assertError(err) {
    if (!isError(err)) {
        throw new Error("Parameter was not an error");
    }
}
export function isError(err) {
    return objectToString(err) === "[object Error]" || err instanceof Error;
}
function objectToString(obj) {
    return Object.prototype.toString.call(obj);
}
