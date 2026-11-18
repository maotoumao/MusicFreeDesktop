export function getDebugBuildName() {
    if (typeof TARGET === "string") {
        return TARGET;
    }
    return "node";
}
export function isReactNative() {
    return typeof TARGET === "string" && TARGET === "react-native";
}
export function isWeb() {
    return typeof TARGET === "string" && TARGET === "web";
}
