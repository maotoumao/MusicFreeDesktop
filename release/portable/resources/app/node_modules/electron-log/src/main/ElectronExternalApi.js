'use strict';

const path = require('path');
const NodeExternalApi = require('../node/NodeExternalApi');

class ElectronExternalApi extends NodeExternalApi {
  /**
   * @type {typeof Electron}
   */
  electron = undefined;

  /**
   * @param {object} options
   * @param {typeof Electron} [options.electron]
   */
  constructor({ electron } = {}) {
    super();
    this.electron = electron;
  }

  getAppName() {
    let appName;
    try {
      appName = this.appName
        || this.electron.app?.name
        || this.electron.app?.getName();
    } catch {
      // fallback to default value below
    }
    return appName || super.getAppName();
  }

  getAppUserDataPath(appName) {
    return this.getPath('userData') || super.getAppUserDataPath(appName);
  }

  getAppVersion() {
    let appVersion;
    try {
      appVersion = this.electron.app?.getVersion();
    } catch {
      // fallback to default value below
    }
    return appVersion || super.getAppVersion();
  }

  getElectronLogPath() {
    return this.getPath('logs') || super.getElectronLogPath();
  }

  /**
   * @private
   * @param {any} name
   * @returns {string|undefined}
   */
  getPath(name) {
    try {
      return this.electron.app?.getPath(name);
    } catch {
      return undefined;
    }
  }

  getVersions() {
    return {
      app: `${this.getAppName()} ${this.getAppVersion()}`,
      electron: `Electron ${process.versions.electron}`,
      os: this.getOsVersion(),
    };
  }

  getSystemPathAppData() {
    return this.getPath('appData') || super.getSystemPathAppData();
  }

  isDev() {
    if (this.electron.app?.isPackaged !== undefined) {
      return !this.electron.app.isPackaged;
    }

    if (typeof process.execPath === 'string') {
      const execFileName = path.basename(process.execPath).toLowerCase();
      return execFileName.startsWith('electron');
    }

    return super.isDev();
  }

  onAppEvent(eventName, handler) {
    this.electron.app?.on(eventName, handler);

    return () => {
      this.electron.app?.off(eventName, handler);
    };
  }

  onAppReady(handler) {
    if (this.electron.app?.isReady()) {
      handler();
    } else if (this.electron.app?.once) {
      this.electron.app?.once('ready', handler);
    } else {
      handler();
    }
  }

  onEveryWebContentsEvent(eventName, handler) {
    this.electron.webContents?.getAllWebContents()?.forEach((webContents) => {
      webContents.on(eventName, handler);
    });

    this.electron.app?.on('web-contents-created', onWebContentsCreated);

    return () => {
      this.electron.webContents?.getAllWebContents().forEach((webContents) => {
        webContents.off(eventName, handler);
      });

      this.electron.app?.off('web-contents-created', onWebContentsCreated);
    };

    function onWebContentsCreated(_, webContents) {
      webContents.on(eventName, handler);
    }
  }

  /**
   * Listen to async messages sent from opposite process
   * @param {string} channel
   * @param {function} listener
   */
  onIpc(channel, listener) {
    this.electron.ipcMain?.on(channel, listener);
  }

  onIpcInvoke(channel, listener) {
    this.electron.ipcMain?.handle?.(channel, listener);
  }

  /**
   * @param {string} url
   * @param {Function} [logFunction]
   */
  openUrl(url, logFunction = console.error) { // eslint-disable-line no-console
    this.electron.shell?.openExternal(url).catch(logFunction);
  }

  setPreloadFileForSessions({
    filePath,
    includeFutureSession = true,
    getSessions = () => [this.electron.session?.defaultSession],
  }) {
    for (const session of getSessions().filter(Boolean)) {
      setPreload(session);
    }

    if (includeFutureSession) {
      this.onAppEvent('session-created', (session) => {
        setPreload(session);
      });
    }

    /**
     * @param {Session} session
     */
    function setPreload(session) {
      session.setPreloads([...session.getPreloads(), filePath]);
    }
  }

  /**
   * Sent a message to opposite process
   * @param {string} channel
   * @param {any} message
   */
  sendIpc(channel, message) {
    this.electron.BrowserWindow?.getAllWindows()?.forEach((wnd) => {
      if (wnd.webContents?.isDestroyed() === false) {
        wnd.webContents.send(channel, message);
      }
    });
  }

  showErrorBox(title, message) {
    this.electron.dialog?.showErrorBox(title, message);
  }
}

module.exports = ElectronExternalApi;
