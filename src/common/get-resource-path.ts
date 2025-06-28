/**
 * 只在主进程中使用 获取资源文件的绝对路径
 * @param resourceName 资源文件名
 * @return 资源文件的绝对路径
 */

import { app } from "electron";
import path from "path";

const resPath = app.isPackaged
    ? path.resolve(process.resourcesPath, "res")
    : path.resolve(__dirname, "../../res");

export default (resourceName: string) => {
    return path.resolve(resPath, resourceName);
};

