import { app } from "electron";
import path from "path";

const resPath = app.isPackaged
  ? path.resolve(process.resourcesPath, "res")
  : path.resolve(__dirname, "../../res");

export const getResPath = (resourceName: string) => {
  return path.resolve(resPath, resourceName);
};

