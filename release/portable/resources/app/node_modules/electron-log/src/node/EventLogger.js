'use strict';

class EventLogger {
  disposers = [];
  format = '{eventSource}#{eventName}:';
  formatters = {
    app: {
      'certificate-error': ({ args }) => {
        return this.arrayToObject(args.slice(1, 4), [
          'url',
          'error',
          'certificate',
        ]);
      },
      'child-process-gone': ({ args }) => {
        return args.length === 1 ? args[0] : args;
      },
      'render-process-gone': ({ args: [webContents, details] }) => {
        return details && typeof details === 'object'
          ? { ...details, ...this.getWebContentsDetails(webContents) }
          : [];
      },
    },

    webContents: {
      'console-message': ({ args: [level, message, line, sourceId] }) => {
        // 0: debug, 1: info, 2: warning, 3: error
        if (level < 3) {
          return undefined;
        }

        return { message, source: `${sourceId}:${line}` };
      },
      'did-fail-load': ({ args }) => {
        return this.arrayToObject(args, [
          'errorCode',
          'errorDescription',
          'validatedURL',
          'isMainFrame',
          'frameProcessId',
          'frameRoutingId',
        ]);
      },
      'did-fail-provisional-load': ({ args }) => {
        return this.arrayToObject(args, [
          'errorCode',
          'errorDescription',
          'validatedURL',
          'isMainFrame',
          'frameProcessId',
          'frameRoutingId',
        ]);
      },
      'plugin-crashed': ({ args }) => {
        return this.arrayToObject(args, ['name', 'version']);
      },
      'preload-error': ({ args }) => {
        return this.arrayToObject(args, ['preloadPath', 'error']);
      },
    },
  };

  events = {
    app: {
      'certificate-error': true,
      'child-process-gone': true,
      'render-process-gone': true,
    },

    webContents: {
      // 'console-message': true,
      'did-fail-load': true,
      'did-fail-provisional-load': true,
      'plugin-crashed': true,
      'preload-error': true,
      'unresponsive': true,
    },
  };

  externalApi = undefined;
  level = 'error';
  scope = '';

  constructor(options = {}) {
    this.setOptions(options);
  }

  setOptions({
    events,
    externalApi,
    level,
    logger,
    format,
    formatters,
    scope,
  }) {
    if (typeof events === 'object') {
      this.events = events;
    }

    if (typeof externalApi === 'object') {
      this.externalApi = externalApi;
    }

    if (typeof level === 'string') {
      this.level = level;
    }

    if (typeof logger === 'object') {
      this.logger = logger;
    }

    if (typeof format === 'string' || typeof format === 'function') {
      this.format = format;
    }

    if (typeof formatters === 'object') {
      this.formatters = formatters;
    }

    if (typeof scope === 'string') {
      this.scope = scope;
    }
  }

  startLogging(options = {}) {
    this.setOptions(options);

    this.disposeListeners();

    for (const eventName of this.getEventNames(this.events.app)) {
      this.disposers.push(
        this.externalApi.onAppEvent(eventName, (...handlerArgs) => {
          this.handleEvent({ eventSource: 'app', eventName, handlerArgs });
        }),
      );
    }

    for (const eventName of this.getEventNames(this.events.webContents)) {
      this.disposers.push(
        this.externalApi.onEveryWebContentsEvent(
          eventName,
          (...handlerArgs) => {
            this.handleEvent(
              { eventSource: 'webContents', eventName, handlerArgs },
            );
          },
        ),
      );
    }
  }

  stopLogging() {
    this.disposeListeners();
  }

  arrayToObject(array, fieldNames) {
    const obj = {};

    fieldNames.forEach((fieldName, index) => {
      obj[fieldName] = array[index];
    });

    if (array.length > fieldNames.length) {
      obj.unknownArgs = array.slice(fieldNames.length);
    }

    return obj;
  }

  disposeListeners() {
    this.disposers.forEach((disposer) => disposer());
    this.disposers = [];
  }

  formatEventLog({ eventName, eventSource, handlerArgs }) {
    const [event, ...args] = handlerArgs;
    if (typeof this.format === 'function') {
      return this.format({ args, event, eventName, eventSource });
    }

    const formatter = this.formatters[eventSource]?.[eventName];
    let formattedArgs = args;
    if (typeof formatter === 'function') {
      formattedArgs = formatter({ args, event, eventName, eventSource });
    }

    if (!formattedArgs) {
      return undefined;
    }

    const eventData = {};

    if (Array.isArray(formattedArgs)) {
      eventData.args = formattedArgs;
    } else if (typeof formattedArgs === 'object') {
      Object.assign(eventData, formattedArgs);
    }

    if (eventSource === 'webContents') {
      Object.assign(eventData, this.getWebContentsDetails(event?.sender));
    }

    const title = this.format
      .replace('{eventSource}', eventSource === 'app' ? 'App' : 'WebContents')
      .replace('{eventName}', eventName);

    return [title, eventData];
  }

  getEventNames(eventMap) {
    if (!eventMap || typeof eventMap !== 'object') {
      return [];
    }

    return Object.entries(eventMap)
      .filter(([_, listen]) => listen)
      .map(([eventName]) => eventName);
  }

  getWebContentsDetails(webContents) {
    if (!webContents?.loadURL) {
      return {};
    }

    try {
      return {
        webContents: {
          id: webContents.id,
          url: webContents.getURL(),
        },
      };
    } catch {
      return {};
    }
  }

  handleEvent({ eventName, eventSource, handlerArgs }) {
    const log = this.formatEventLog({ eventName, eventSource, handlerArgs });
    if (log) {
      const logFns = this.scope ? this.logger.scope(this.scope) : this.logger;
      logFns?.[this.level]?.(...log);
    }
  }
}

module.exports = EventLogger;
