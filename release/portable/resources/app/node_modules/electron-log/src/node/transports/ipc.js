'use strict';

const { maxDepth, toJSON } = require('../transforms/object');
const { transform } = require('../transforms/transform');

module.exports = ipcTransportFactory;

/**
 * @param logger
 * @param {ElectronExternalApi} externalApi
 * @returns {transport|null}
 */
function ipcTransportFactory(logger, { externalApi }) {
  Object.assign(transport, {
    depth: 3,
    eventId: '__ELECTRON_LOG_IPC__',
    level: logger.isDev ? 'silly' : false,
    transforms: [toJSON, maxDepth],
  });

  return externalApi?.isElectron() ? transport : undefined;

  function transport(message) {
    if (message?.variables?.processType === 'renderer') {
      return;
    }

    externalApi?.sendIpc(transport.eventId, {
      ...message,
      data: transform({ logger, message, transport }),
    });
  }
}
