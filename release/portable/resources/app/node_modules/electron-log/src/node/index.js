'use strict';

const NodeExternalApi = require('./NodeExternalApi');
const createDefaultLogger = require('./createDefaultLogger');

const externalApi = new NodeExternalApi();

const defaultLogger = createDefaultLogger({
  dependencies: { externalApi },
});

module.exports = defaultLogger;
