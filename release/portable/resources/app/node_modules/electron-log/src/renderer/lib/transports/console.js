'use strict';

/* eslint-disable no-console */

module.exports = consoleTransportRendererFactory;

const consoleMethods = {
  error: console.error,
  warn: console.warn,
  info: console.info,
  verbose: console.info,
  debug: console.debug,
  silly: console.debug,
  log: console.log,
};

function consoleTransportRendererFactory(logger) {
  return Object.assign(transport, {
    format: '{h}:{i}:{s}.{ms}{scope} › {text}',

    formatDataFn({
      data = [],
      date = new Date(),
      format = transport.format,
      logId = logger.logId,
      scope = logger.scopeName,
      ...message
    }) {
      if (typeof format === 'function') {
        return format({ ...message, data, date, logId, scope });
      }

      if (typeof format !== 'string') {
        return data;
      }

      data.unshift(format);

      // Concatenate first two data items to support printf-like templates
      if (typeof data[1] === 'string' && data[1].match(/%[1cdfiOos]/)) {
        data = [`${data[0]} ${data[1]}`, ...data.slice(2)];
      }

      data[0] = data[0]
        .replace(/\{(\w+)}/g, (substring, name) => {
          switch (name) {
            case 'level': return message.level;
            case 'logId': return logId;
            case 'scope': return scope ? ` (${scope})` : '';
            case 'text': return '';

            case 'y': return date.getFullYear().toString(10);
            case 'm': return (date.getMonth() + 1).toString(10)
              .padStart(2, '0');
            case 'd': return date.getDate().toString(10).padStart(2, '0');
            case 'h': return date.getHours().toString(10).padStart(2, '0');
            case 'i': return date.getMinutes().toString(10).padStart(2, '0');
            case 's': return date.getSeconds().toString(10).padStart(2, '0');
            case 'ms': return date.getMilliseconds().toString(10)
              .padStart(3, '0');
            case 'iso': return date.toISOString();

            default: {
              return message.variables?.[name] || substring;
            }
          }
        })
        .trim();

      return data;
    },

    writeFn({ message: { level, data } }) {
      const consoleLogFn = consoleMethods[level] || consoleMethods.info;

      // make an empty call stack
      setTimeout(() => consoleLogFn(...data));
    },

  });

  function transport(message) {
    transport.writeFn({
      message: { ...message, data: transport.formatDataFn(message) },
    });
  }
}
