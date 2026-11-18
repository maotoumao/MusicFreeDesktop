'use strict';

const http = require('http');
const https = require('https');
const { transform } = require('../transforms/transform');
const { removeStyles } = require('../transforms/style');
const { toJSON, maxDepth } = require('../transforms/object');

module.exports = remoteTransportFactory;

function remoteTransportFactory(logger) {
  return Object.assign(transport, {
    client: { name: 'electron-application' },
    depth: 6,
    level: false,
    requestOptions: {},
    transforms: [removeStyles, toJSON, maxDepth],

    makeBodyFn({ message }) {
      return JSON.stringify({
        client: transport.client,
        data: message.data,
        date: message.date.getTime(),
        level: message.level,
        scope: message.scope,
        variables: message.variables,
      });
    },

    processErrorFn({ error }) {
      logger.processMessage(
        {
          data: [`electron-log: can't POST ${transport.url}`, error],
          level: 'warn',
        },
        { transports: ['console', 'file'] },
      );
    },

    sendRequestFn({ serverUrl, requestOptions, body }) {
      const httpTransport = serverUrl.startsWith('https:') ? https : http;

      const request = httpTransport.request(serverUrl, {
        method: 'POST',
        ...requestOptions,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body.length,
          ...requestOptions.headers,
        },
      });

      request.write(body);
      request.end();

      return request;
    },
  });

  function transport(message) {
    if (!transport.url) {
      return;
    }

    const body = transport.makeBodyFn({
      logger,
      message: { ...message, data: transform({ logger, message, transport }) },
      transport,
    });

    const request = transport.sendRequestFn({
      serverUrl: transport.url,
      requestOptions: transport.requestOptions,
      body: Buffer.from(body, 'utf8'),
    });

    request.on('error', (error) => transport.processErrorFn({
      error,
      logger,
      message,
      request,
      transport,
    }));
  }
}
