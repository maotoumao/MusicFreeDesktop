import { contextBridge, ipcRenderer } from "electron";
import fs from "fs/promises";
import { rimraf } from "rimraf";
import url from "url";


/****** fs utils ******/
const originalFsWriteFile = fs.writeFile;
const originalFsReadFile = fs.readFile;

function writeFile(...args: Parameters<typeof originalFsWriteFile>): ReturnType<typeof originalFsWriteFile> {
    return originalFsWriteFile(...args);
}

function readFile(...args: Parameters<typeof originalFsReadFile>): ReturnType<typeof originalFsReadFile> {
    return originalFsReadFile(...args);
}

async function isFile(path: string) {
    try {
        const stat = await fs.stat(path);
        return stat.isFile();
    } catch {
        return false;
    }
}

async function isFolder(path: string) {
    try {
        const stat = await fs.stat(path);
        return stat.isDirectory();
    } catch {
        return false;
    }
}

function addFileScheme(filePath: string) {
    return filePath.startsWith("file:")
        ? filePath
        : url.pathToFileURL(filePath).toString();
}

const fsUtil = {
    writeFile,
    readFile,
    isFile,
    isFolder,
    rimraf,
    addFileScheme,
};

/****** app utils *****/
function exitApp() {
    ipcRenderer.send("@shared/utils/exit-app");
}

async function getPath(pathName: "home" | "appData" | "userData" | "sessionData" | "temp" | "exe" | "module" | "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos" | "recent" | "logs" | "crashDumps") {
    return await ipcRenderer.invoke("@shared/utils/app-get-path", pathName);
}

async function checkUpdate() {
    return await ipcRenderer.invoke("@shared/utils/check-update");
}

async function getCacheSize() {
    return await ipcRenderer.invoke("@shared/utils/get-cache-size");
}

async function clearCache() {
    ipcRenderer.send("@shared/utils/clear-cache");
}

const app = {
    exitApp,
    getPath,
    checkUpdate,
    getCacheSize,
    clearCache,
};


/****** window utils *****/
function minMainWindow(skipTaskBar: boolean) {
    ipcRenderer.send("@shared/utils/min-main-window", { skipTaskBar });
}

function showMainWindow() {
    ipcRenderer.send("@shared/utils/show-main-window");
}

function setLyricWindow(enabled: boolean) {
    ipcRenderer.send("@shared/utils/set-lyric-window", enabled);
}

function setMinimodeWindow(enabled: boolean) {
    ipcRenderer.send("@shared/utils/set-minimode-window", enabled);
}

function setVisualizationWindow(enabled: boolean) {
    ipcRenderer.send("@shared/utils/set-visualization-window", enabled);
}

function ignoreMouseEvent(ignore: boolean) {
    ipcRenderer.send("@shared/utils/ignore-mouse-event", ignore);
}

function toggleMainWindowVisible() {
    ipcRenderer.send("@shared/utils/toggle-main-window-visible");
}

function toggleMainWindowMaximize() {
    ipcRenderer.send("@shared/utils/toggle-maximize-main-window");
}

const appWindow = {
    minMainWindow,
    showMainWindow,
    setLyricWindow,
    setMinimodeWindow,
    setVisualizationWindow,
    ignoreMouseEvent,
    toggleMainWindowVisible,
    toggleMainWindowMaximize,
};

/****** shell utils *****/
function openExternal(url: string) {
    ipcRenderer.send("@shared/utils/open-url", url);
}

function openPath(path: string) {
    ipcRenderer.send("@shared/utils/open-path", path);
}

async function showItemInFolder(path: string): Promise<boolean> {
    return await ipcRenderer.invoke("@shared/utils/show-item-in-folder", path);
}

const shell = {
    openExternal,
    openPath,
    showItemInFolder,
};

/****** dialog utils *****/
function showOpenDialog(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> {
    return ipcRenderer.invoke("@shared/utils/show-open-dialog", options);
}

function showSaveDialog(options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> {
    return ipcRenderer.invoke("@shared/utils/show-save-dialog", options);
}

const dialog = {
    showOpenDialog,
    showSaveDialog,
};


/****** updater utils ******/
async function downloadUpdate(assetUrl: string, assetName: string) {
    return await ipcRenderer.invoke("@shared/updater/download", {
        assetUrl,
        assetName,
    });
}

async function cancelUpdateDownload() {
    return await ipcRenderer.invoke("@shared/updater/cancel-download");
}

async function installUpdate(version: string) {
    return await ipcRenderer.invoke("@shared/updater/install", { version });
}

async function getLastUpdateResult() {
    return await ipcRenderer.invoke("@shared/updater/last-result");
}

function onUpdateProgress(
    callback: (progress: ICommon.IUpdaterProgress) => void,
) {
    const listener = (
        _e: Electron.IpcRendererEvent,
        progress: ICommon.IUpdaterProgress,
    ) => callback(progress);
    ipcRenderer.on("@shared/updater/progress", listener);
    return () => {
        ipcRenderer.removeListener("@shared/updater/progress", listener);
    };
}

function onUpdateStatus(callback: (status: ICommon.IUpdaterStatus) => void) {
    const listener = (
        _e: Electron.IpcRendererEvent,
        status: ICommon.IUpdaterStatus,
    ) => callback(status);
    ipcRenderer.on("@shared/updater/status", listener);
    return () => {
        ipcRenderer.removeListener("@shared/updater/status", listener);
    };
}

const updater = {
    download: downloadUpdate,
    cancelDownload: cancelUpdateDownload,
    install: installUpdate,
    getLastResult: getLastUpdateResult,
    onProgress: onUpdateProgress,
    onStatus: onUpdateStatus,
};


const mod = {
    fs: fsUtil,
    app,
    appWindow,
    shell,
    dialog,
    updater,
};

contextBridge.exposeInMainWorld("@shared/utils", mod);

