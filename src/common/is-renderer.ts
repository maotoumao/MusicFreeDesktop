export function isRenderer() {
    if (typeof process === "undefined" || !process) {
        // renderer process has no process variable with nodeIntegration off and sandbox on 
        return true;
    } 

    return process.type === "renderer";
}
