'use strict';

const Logger = require('../core/Logger');
const RendererErrorHandler = require('./lib/RendererErrorHandler');
const transportConsole = require('./lib/transports/console');
const transportIpc = require('./lib/transports/ipc');

module.exports = createLogger();
module.exports.Logger = Logger;
module.exports.default = module.exports;

function createLogger() {
  const logger = new Logger({
    allowUnknownLevel: true,
    errorHandler: new RendererErrorHandler(),
    initializeFn: () => {},
    logId: 'default',
    transportFactories: {
      console: transportConsole,
      ipc: transportIpc,
    },
    variables: {
      processType: 'renderer',
    },
  });

  logger.errorHandler.setOptions({
    logFn({ error, errorName, showDialog }) {
      logger.transports.console({
        data: [errorName, error].filter(Boolean),
        level: 'error',
      });
      logger.transports.ipc({
        cmd: 'errorHandler',
        error: {
          cause: error?.cause,
          code: error?.code,
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
        },
        errorName,
        logId: logger.logId,
        showDialog,
      });
    },
  });

  if (typeof window === 'object') {
    window.addEventListener('message', (event) => {
      const { cmd, logId, ...message } = event.data || {};
      const instance = Logger.getInstance({ logId });

      if (cmd === 'message') {
        instance.processMessage(message, { transports: ['console'] });
      }
    });
  }

  // To support custom levels
  return new Proxy(logger, {
    get(target, prop) {
      if (typeof target[prop] !== 'undefined') {
        return target[prop];
      }

      return (...data) => logger.logData(data, { level: prop });
    },
  });
}
