import { BrowserWindow, app } from "electron";


declare const WORKER_DOWNLOADER_WEBPACK_ENTRY: string;


export default function injectGlobalData(targetWindow: BrowserWindow) {
    if (!targetWindow) {
      return;
    }
  
    const globalData: IGlobalData = {
      appVersion: app.getVersion(),
      workersPath: {
        downloader: WORKER_DOWNLOADER_WEBPACK_ENTRY
      },
      appPath: {
        downloads: app.getPath('downloads'),
        temp: app.getPath('temp'),
        userData: app.getPath('userData')
      },
      platform: process.platform
    };
    targetWindow.webContents.executeJavaScript(
      `window.globalData=${JSON.stringify(globalData)};console.log('injected!!')`
    );
  }