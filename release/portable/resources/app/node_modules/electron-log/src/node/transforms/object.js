'use strict';

const util = require('util');

module.exports = {
  serialize,

  maxDepth({ data, transport, depth = transport?.depth ?? 6 }) {
    if (!data) {
      return data;
    }

    if (depth < 1) {
      if (Array.isArray(data)) return '[array]';
      if (typeof data === 'object' && data) return '[object]';

      return data;
    }

    if (Array.isArray(data)) {
      return data.map((child) => module.exports.maxDepth({
        data: child,
        depth: depth - 1,
      }));
    }

    if (typeof data !== 'object') {
      return data;
    }

    if (data && typeof data.toISOString === 'function') {
      return data;
    }

    // noinspection PointlessBooleanExpressionJS
    if (data === null) {
      return null;
    }

    if (data instanceof Error) {
      return data;
    }

    const newJson = {};
    for (const i in data) {
      if (!Object.prototype.hasOwnProperty.call(data, i)) continue;
      newJson[i] = module.exports.maxDepth({
        data: data[i],
        depth: depth - 1,
      });
    }

    return newJson;
  },

  toJSON({ data }) {
    return JSON.parse(JSON.stringify(data, createSerializer()));
  },

  toString({ data, transport }) {
    const inspectOptions = transport?.inspectOptions || {};

    const simplifiedData = data.map((item) => {
      if (item === undefined) {
        return undefined;
      }

      try {
        const str = JSON.stringify(item, createSerializer(), '  ');
        return str === undefined ? undefined : JSON.parse(str);
      } catch (e) {
        // There are some rare cases when an item can't be simplified.
        // In that case, it's fine to pass it to util.format directly.
        return item;
      }
    });

    return util.formatWithOptions(inspectOptions, ...simplifiedData);
  },
};

/**
 * @param {object} options?
 * @param {boolean} options.serializeMapAndSet?
 * @return {function}
 */
function createSerializer(options = {}) {
  const seen = new WeakSet();

  return function (key, value) {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return undefined;
      }

      seen.add(value);
    }

    return serialize(key, value, options);
  };
}

/**
 * @param {string} key
 * @param {any} value
 * @param {object} options?
 * @return {any}
 */
function serialize(key, value, options = {}) {
  const serializeMapAndSet = options?.serializeMapAndSet !== false;

  if (value instanceof Error) {
    return value.stack;
  }

  if (!value) {
    return value;
  }

  if (typeof value === 'function') {
    return `[function] ${value.toString()}`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (serializeMapAndSet && value instanceof Map && Object.fromEntries) {
    return Object.fromEntries(value);
  }

  if (serializeMapAndSet && value instanceof Set && Array.from) {
    return Array.from(value);
  }

  return value;
}
