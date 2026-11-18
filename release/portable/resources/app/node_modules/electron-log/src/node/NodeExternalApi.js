'use strict';

/* eslint-disable no-unused-vars */

const childProcess = require('child_process');
const os = require('os');
const path = require('path');
const packageJson = require('./packageJson');

class NodeExternalApi {
  appName = undefined;
  appPackageJson = undefined;
  platform = process.platform;

  getAppLogPath(appName = this.getAppName()) {
    if (this.platform === 'darwin') {
      return path.join(this.getSystemPathHome(), 'Library/Logs', appName);
    }

    return path.join(this.getAppUserDataPath(appName), 'logs');
  }

  getAppName() {
    const appName = this.appName || this.getAppPackageJson()?.name;
    if (!appName) {
      throw new Error(
        'electron-log can\'t determine the app name. It tried these methods:\n'
        + '1. Use `electron.app.name`\n'
        + '2. Use productName or name from the nearest package.json`\n'
        + 'You can also set it through log.transports.file.setAppName()',
      );
    }

    return appName;
  }

  /**
   * @private
   * @returns {undefined}
   */
  getAppPackageJson() {
    if (typeof this.appPackageJson !== 'object') {
      this.appPackageJson = packageJson.findAndReadPackageJson();
    }

    return this.appPackageJson;
  }

  getAppUserDataPath(appName = this.getAppName()) {
    return appName
      ? path.join(this.getSystemPathAppData(), appName)
      : undefined;
  }

  getAppVersion() {
    return this.getAppPackageJson()?.version;
  }

  getElectronLogPath() {
    return this.getAppLogPath();
  }

  getMacOsVersion() {
    const release = Number(os.release().split('.')[0]);
    if (release <= 19) {
      return `10.${release - 4}`;
    }

    return release - 9;
  }

  /**
   * @protected
   * @returns {string}
   */
  getOsVersion() {
    let osName = os.type().replace('_', ' ');
    let osVersion = os.release();

    if (osName === 'Darwin') {
      osName = 'macOS';
      osVersion = this.getMacOsVersion();
    }

    return `${osName} ${osVersion}`;
  }

  /**
   * @return {PathVariables}
   */
  getPathVariables() {
    const appName = this.getAppName();
    const appVersion = this.getAppVersion();

    const self = this;

    return {
      appData: this.getSystemPathAppData(),
      appName,
      appVersion,
      get electronDefaultDir() {
        return self.getElectronLogPath();
      },
      home: this.getSystemPathHome(),
      libraryDefaultDir: this.getAppLogPath(appName),
      libraryTemplate: this.getAppLogPath('{appName}'),
      temp: this.getSystemPathTemp(),
      userData: this.getAppUserDataPath(appName),
    };
  }

  getSystemPathAppData() {
    const home = this.getSystemPathHome();

    switch (this.platform) {
      case 'darwin': {
        return path.join(home, 'Library/Application Support');
      }

      case 'win32': {
        return process.env.APPDATA || path.join(home, 'AppData/Roaming');
      }

      default: {
        return process.env.XDG_CONFIG_HOME || path.join(home, '.config');
      }
    }
  }

  getSystemPathHome() {
    return os.homedir?.() || process.env.HOME;
  }

  getSystemPathTemp() {
    return os.tmpdir();
  }

  getVersions() {
    return {
      app: `${this.getAppName()} ${this.getAppVersion()}`,
      electron: undefined,
      os: this.getOsVersion(),
    };
  }

  isDev() {
    return process.env.NODE_ENV === 'development'
      || process.env.ELECTRON_IS_DEV === '1';
  }

  isElectron() {
    return Boolean(process.versions.electron);
  }

  onAppEvent(_eventName, _handler) {
    // Ignored in node.js
  }

  onAppReady(handler) {
    handler();
  }

  onEveryWebContentsEvent(eventName, handler) {
    // Ignored in node.js
  }

  /**
   * Listen to async messages sent from opposite process
   * @param {string} channel
   * @param {function} listener
   */
  onIpc(channel, listener) {
    // Ignored in node.js
  }

  onIpcInvoke(channel, listener) {
    // Ignored in node.js
  }

  /**
   * @param {string} url
   * @param {Function} [logFunction]
   */
  openUrl(url, logFunction = console.error) { // eslint-disable-line no-console
    const startMap = { darwin: 'open', win32: 'start', linux: 'xdg-open' };
    const start = startMap[process.platform] || 'xdg-open';
    childProcess.exec(`${start} ${url}`, {}, (err) => {
      if (err) {
        logFunction(err);
      }
    });
  }

  setAppName(appName) {
    this.appName = appName;
  }

  setPlatform(platform) {
    this.platform = platform;
  }

  setPreloadFileForSessions({
    filePath, // eslint-disable-line no-unused-vars
    includeFutureSession = true, // eslint-disable-line no-unused-vars
    getSessions = () => [], // eslint-disable-line no-unused-vars
  }) {
    // Ignored in node.js
  }

  /**
   * Sent a message to opposite process
   * @param {string} channel
   * @param {any} message
   */
  sendIpc(channel, message) {
    // Ignored in node.js
  }

  showErrorBox(title, message) {
    // Ignored in node.js
  }
}

module.exports = NodeExternalApi;
