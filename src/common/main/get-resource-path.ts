import { app } from "electron";
import path from "path";

const resPath = app.isPackaged
    ? path.resolve(process.resourcesPath, "res")
    : path.resolve(__dirname, "../../res");

export default (resourceName: string) => {
    return path.resolve(resPath, resourceName);
};

