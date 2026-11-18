'use strict';

/* eslint-disable no-console */

const { concatFirstStringElements, format } = require('../transforms/format');
const { maxDepth, toJSON } = require('../transforms/object');
const { applyAnsiStyles, removeStyles } = require('../transforms/style');
const { transform } = require('../transforms/transform');

const consoleMethods = {
  error: console.error,
  warn: console.warn,
  info: console.info,
  verbose: console.info,
  debug: console.debug,
  silly: console.debug,
  log: console.log,
};

module.exports = consoleTransportFactory;

const separator = process.platform === 'win32' ? '>' : '›';
const DEFAULT_FORMAT = `%c{h}:{i}:{s}.{ms}{scope}%c ${separator} {text}`;

Object.assign(consoleTransportFactory, {
  DEFAULT_FORMAT,
});

function consoleTransportFactory(logger) {
  return Object.assign(transport, {
    format: DEFAULT_FORMAT,
    level: 'silly',
    transforms: [
      addTemplateColors,
      format,
      formatStyles,
      concatFirstStringElements,
      maxDepth,
      toJSON,
    ],
    useStyles: process.env.FORCE_STYLES,

    writeFn({ message }) {
      const consoleLogFn = consoleMethods[message.level] || consoleMethods.info;
      consoleLogFn(...message.data);
    },
  });

  function transport(message) {
    const data = transform({ logger, message, transport });
    transport.writeFn({
      message: { ...message, data },
    });
  }
}

function addTemplateColors({ data, message, transport }) {
  if (transport.format !== DEFAULT_FORMAT) {
    return data;
  }

  return [`color:${levelToStyle(message.level)}`, 'color:unset', ...data];
}

function canUseStyles(useStyleValue, level) {
  if (typeof useStyleValue === 'boolean') {
    return useStyleValue;
  }

  const useStderr = level === 'error' || level === 'warn';
  const stream = useStderr ? process.stderr : process.stdout;
  return stream && stream.isTTY;
}

function formatStyles(args) {
  const { message, transport } = args;
  const useStyles = canUseStyles(transport.useStyles, message.level);
  const nextTransform = useStyles ? applyAnsiStyles : removeStyles;
  return nextTransform(args);
}

function levelToStyle(level) {
  const map = { error: 'red', warn: 'yellow', info: 'cyan', default: 'unset' };
  return map[level] || map.default;
}
