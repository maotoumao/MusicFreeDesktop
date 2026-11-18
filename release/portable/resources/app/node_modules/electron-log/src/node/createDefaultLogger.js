'use strict';

const Logger = require('../core/Logger');
const ErrorHandler = require('./ErrorHandler');
const EventLogger = require('./EventLogger');
const transportConsole = require('./transports/console');
const transportFile = require('./transports/file');
const transportIpc = require('./transports/ipc');
const transportRemote = require('./transports/remote');

module.exports = createDefaultLogger;

function createDefaultLogger({ dependencies, initializeFn }) {
  const defaultLogger = new Logger({
    dependencies,
    errorHandler: new ErrorHandler(),
    eventLogger: new EventLogger(),
    initializeFn,
    isDev: dependencies.externalApi?.isDev(),
    logId: 'default',
    transportFactories: {
      console: transportConsole,
      file: transportFile,
      ipc: transportIpc,
      remote: transportRemote,
    },
    variables: {
      processType: 'main',
    },
  });

  defaultLogger.default = defaultLogger;
  defaultLogger.Logger = Logger;

  defaultLogger.processInternalErrorFn = (e) => {
    defaultLogger.transports.console.writeFn({
      message: {
        data: ['Unhandled electron-log error', e],
        level: 'error',
      },
    });
  };

  return defaultLogger;
}
