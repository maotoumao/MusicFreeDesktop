'use strict';

module.exports = ipcTransportRendererFactory;

const RESTRICTED_TYPES = new Set([Promise, WeakMap, WeakSet]);

function ipcTransportRendererFactory(logger) {
  return Object.assign(transport, {
    depth: 5,

    serializeFn(data, { depth = 5, seen = new WeakSet() } = {}) {
      if (seen.has(data)) {
        return '[Circular]';
      }

      if (depth < 1) {
        if (isPrimitive(data)) {
          return data;
        }

        if (Array.isArray(data)) {
          return '[Array]';
        }

        return `[${typeof data}]`;
      }

      if (['function', 'symbol'].includes(typeof data)) {
        return data.toString();
      }

      if (isPrimitive(data)) {
        return data;
      }

      // Object types

      if (RESTRICTED_TYPES.has(data.constructor)) {
        return `[${data.constructor.name}]`;
      }

      if (Array.isArray(data)) {
        return data.map((item) => transport.serializeFn(
          item,
          { depth: depth - 1, seen },
        ));
      }

      if (data instanceof Date) {
        return data.toISOString();
      }

      if (data instanceof Error) {
        return data.stack;
      }

      if (data instanceof Map) {
        return new Map(
          Array
            .from(data)
            .map(([key, value]) => [
              transport.serializeFn(key, { depth: depth - 1, seen }),
              transport.serializeFn(value, { depth: depth - 1, seen }),
            ]),
        );
      }

      if (data instanceof Set) {
        return new Set(
          Array.from(data).map(
            (val) => transport.serializeFn(val, { depth: depth - 1, seen }),
          ),
        );
      }

      seen.add(data);

      return Object.fromEntries(
        Object.entries(data).map(
          ([key, value]) => [
            key,
            transport.serializeFn(value, { depth: depth - 1, seen }),
          ],
        ),
      );
    },
  });

  function transport(message) {
    if (!window.__electronLog) {
      logger.processMessage(
        {
          data: ['electron-log: logger isn\'t initialized in the main process'],
          level: 'error',
        },
        { transports: ['console'] },
      );
      return;
    }

    try {
      __electronLog.sendToMain(transport.serializeFn(message, {
        depth: transport.depth,
      }));
    } catch (e) {
      logger.transports.console({
        data: ['electronLog.transports.ipc', e, 'data:', message.data],
        level: 'error',
      });
    }
  }
}

/**
 * Is type primitive, including null and undefined
 * @param {any} value
 * @returns {boolean}
 */
function isPrimitive(value) {
  return Object(value) !== value;
}
