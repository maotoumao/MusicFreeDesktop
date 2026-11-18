'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const FileRegistry = require('./FileRegistry');
const { transform } = require('../../transforms/transform');
const { removeStyles } = require('../../transforms/style');
const {
  format,
  concatFirstStringElements,
} = require('../../transforms/format');
const { toString } = require('../../transforms/object');

module.exports = fileTransportFactory;

// Shared between multiple file transport instances
const globalRegistry = new FileRegistry();

function fileTransportFactory(
  logger,
  { registry = globalRegistry, externalApi } = {},
) {
  /** @type {PathVariables} */
  let pathVariables;

  if (registry.listenerCount('error') < 1) {
    registry.on('error', (e, file) => {
      logConsole(`Can't write to ${file}`, e);
    });
  }

  return Object.assign(transport, {
    fileName: getDefaultFileName(logger.variables.processType),
    format: '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]{scope} {text}',
    getFile,
    inspectOptions: { depth: 5 },
    level: 'silly',
    maxSize: 1024 ** 2,
    readAllLogs,
    sync: true,
    transforms: [removeStyles, format, concatFirstStringElements, toString],
    writeOptions: { flag: 'a', mode: 0o666, encoding: 'utf8' },

    archiveLogFn(file) {
      const oldPath = file.toString();
      const inf = path.parse(oldPath);
      try {
        fs.renameSync(oldPath, path.join(inf.dir, `${inf.name}.old${inf.ext}`));
      } catch (e) {
        logConsole('Could not rotate log', e);
        const quarterOfMaxSize = Math.round(transport.maxSize / 4);
        file.crop(Math.min(quarterOfMaxSize, 256 * 1024));
      }
    },

    resolvePathFn(vars) {
      return path.join(vars.libraryDefaultDir, vars.fileName);
    },

    setAppName(name) {
      logger.dependencies.externalApi.setAppName(name);
    },
  });

  function transport(message) {
    const file = getFile(message);

    const needLogRotation = transport.maxSize > 0
      && file.size > transport.maxSize;

    if (needLogRotation) {
      transport.archiveLogFn(file);
      file.reset();
    }

    const content = transform({ logger, message, transport });
    file.writeLine(content);
  }

  function initializeOnFirstAccess() {
    if (pathVariables) {
      return;
    }

    // Make a shallow copy of pathVariables to keep getters intact
    pathVariables = Object.create(
      Object.prototype,
      {
        ...Object.getOwnPropertyDescriptors(
          externalApi.getPathVariables(),
        ),
        fileName: {
          get() {
            return transport.fileName;
          },
          enumerable: true,
        },
      },
    );

    if (typeof transport.archiveLog === 'function') {
      transport.archiveLogFn = transport.archiveLog;
      logConsole('archiveLog is deprecated. Use archiveLogFn instead');
    }

    if (typeof transport.resolvePath === 'function') {
      transport.resolvePathFn = transport.resolvePath;
      logConsole('resolvePath is deprecated. Use resolvePathFn instead');
    }
  }

  function logConsole(message, error = null, level = 'error') {
    const data = [`electron-log.transports.file: ${message}`];

    if (error) {
      data.push(error);
    }

    logger.transports.console({ data, date: new Date(), level });
  }

  function getFile(msg) {
    initializeOnFirstAccess();

    const filePath = transport.resolvePathFn(pathVariables, msg);
    return registry.provide({
      filePath,
      writeAsync: !transport.sync,
      writeOptions: transport.writeOptions,
    });
  }

  function readAllLogs({ fileFilter = (f) => f.endsWith('.log') } = {}) {
    initializeOnFirstAccess();
    const logsPath = path.dirname(transport.resolvePathFn(pathVariables));

    if (!fs.existsSync(logsPath)) {
      return [];
    }

    return fs.readdirSync(logsPath)
      .map((fileName) => path.join(logsPath, fileName))
      .filter(fileFilter)
      .map((logPath) => {
        try {
          return {
            path: logPath,
            lines: fs.readFileSync(logPath, 'utf8').split(os.EOL),
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }
}

function getDefaultFileName(processType = process.type) {
  switch (processType) {
    case 'renderer': return 'renderer.log';
    case 'worker': return 'worker.log';
    default: return 'main.log';
  }
}
