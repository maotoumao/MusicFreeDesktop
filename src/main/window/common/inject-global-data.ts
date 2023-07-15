import { BrowserWindow, app } from "electron";

export default function injectGlobalData(targetWindow: BrowserWindow) {
    if (!targetWindow) {
      return;
    }
  
    const globalData: IGlobalData = {
      appVersion: app.getVersion(),
    };
    targetWindow.webContents.executeJavaScript(
      `window.globalData=${JSON.stringify(globalData)}`
    );
  }