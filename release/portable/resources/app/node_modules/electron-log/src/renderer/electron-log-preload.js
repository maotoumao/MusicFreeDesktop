'use strict';

let electron = {};

try {
  // eslint-disable-next-line global-require,import/no-extraneous-dependencies
  electron = require('electron');
} catch (e) {
  // require isn't available, not from a preload script
}

if (electron.ipcRenderer) {
  initialize(electron);
}

if (typeof module === 'object') {
  module.exports = initialize;
}

/**
 * @param {Electron.ContextBridge} contextBridge
 * @param {Electron.IpcRenderer} ipcRenderer
 */
function initialize({ contextBridge, ipcRenderer }) {
  if (!ipcRenderer) {
    return;
  }

  ipcRenderer.on('__ELECTRON_LOG_IPC__', (_, message) => {
    window.postMessage({ cmd: 'message', ...message });
  });

  ipcRenderer
    .invoke('__ELECTRON_LOG__', { cmd: 'getOptions' })
    // eslint-disable-next-line no-console
    .catch((e) => console.error(new Error(
      'electron-log isn\'t initialized in the main process. '
      + `Please call log.initialize() before. ${e.message}`,
    )));

  const electronLog = {
    sendToMain(message) {
      try {
        ipcRenderer.send('__ELECTRON_LOG__', message);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('electronLog.sendToMain ', e, 'data:', message);

        ipcRenderer.send('__ELECTRON_LOG__', {
          cmd: 'errorHandler',
          error: { message: e?.message, stack: e?.stack },
          errorName: 'sendToMain',
        });
      }
    },

    log(...data) {
      electronLog.sendToMain({ data, level: 'info' });
    },
  };

  for (const level of ['error', 'warn', 'info', 'verbose', 'debug', 'silly']) {
    electronLog[level] = (...data) => electronLog.sendToMain({
      data,
      level,
    });
  }

  if (contextBridge && process.contextIsolated) {
    try {
      contextBridge.exposeInMainWorld('__electronLog', electronLog);
    } catch {
      // Sometimes this files can be included twice
    }
  }

  if (typeof window === 'object') {
    window.__electronLog = electronLog;
  } else {
    // noinspection JSConstantReassignment
    __electronLog = electronLog;
  }
}
