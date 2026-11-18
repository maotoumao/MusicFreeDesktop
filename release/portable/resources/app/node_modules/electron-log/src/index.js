'use strict';

/* eslint-disable global-require */

const isRenderer = typeof process === 'undefined'
  || (process.type === 'renderer' || process.type === 'worker');

const isMain = typeof process === 'object' && process.type === 'browser';

if (isRenderer) {
  // Makes sense when contextIsolation/sandbox disabled
  require('./renderer/electron-log-preload');
  module.exports = require('./renderer');
} else if (isMain) {
  module.exports = require('./main');
} else {
  module.exports = require('./node');
}
