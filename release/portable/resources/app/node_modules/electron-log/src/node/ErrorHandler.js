'use strict';

class ErrorHandler {
  externalApi = undefined;
  isActive = false;
  logFn = undefined;
  onError = undefined;
  showDialog = true;

  constructor({
    externalApi,
    logFn = undefined,
    onError = undefined,
    showDialog = undefined,
  } = {}) {
    this.createIssue = this.createIssue.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleRejection = this.handleRejection.bind(this);
    this.setOptions({ externalApi, logFn, onError, showDialog });
    this.startCatching = this.startCatching.bind(this);
    this.stopCatching = this.stopCatching.bind(this);
  }

  handle(error, {
    logFn = this.logFn,
    onError = this.onError,
    processType = 'browser',
    showDialog = this.showDialog,
    errorName = '',
  } = {}) {
    error = normalizeError(error);

    try {
      if (typeof onError === 'function') {
        const versions = this.externalApi?.getVersions() || {};
        const createIssue = this.createIssue;
        const result = onError({
          createIssue,
          error,
          errorName,
          processType,
          versions,
        });
        if (result === false) {
          return;
        }
      }

      errorName ? logFn(errorName, error) : logFn(error);

      if (showDialog && !errorName.includes('rejection') && this.externalApi) {
        this.externalApi.showErrorBox(
          `A JavaScript error occurred in the ${processType} process`,
          error.stack,
        );
      }
    } catch {
      console.error(error); // eslint-disable-line no-console
    }
  }

  setOptions({ externalApi, logFn, onError, showDialog }) {
    if (typeof externalApi === 'object') {
      this.externalApi = externalApi;
    }

    if (typeof logFn === 'function') {
      this.logFn = logFn;
    }

    if (typeof onError === 'function') {
      this.onError = onError;
    }

    if (typeof showDialog === 'boolean') {
      this.showDialog = showDialog;
    }
  }

  startCatching({ onError, showDialog } = {}) {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.setOptions({ onError, showDialog });
    process.on('uncaughtException', this.handleError);
    process.on('unhandledRejection', this.handleRejection);
  }

  stopCatching() {
    this.isActive = false;
    process.removeListener('uncaughtException', this.handleError);
    process.removeListener('unhandledRejection', this.handleRejection);
  }

  createIssue(pageUrl, queryParams) {
    this.externalApi?.openUrl(
      `${pageUrl}?${new URLSearchParams(queryParams).toString()}`,
    );
  }

  handleError(error) {
    this.handle(error, { errorName: 'Unhandled' });
  }

  handleRejection(reason) {
    const error = reason instanceof Error
      ? reason
      : new Error(JSON.stringify(reason));
    this.handle(error, { errorName: 'Unhandled rejection' });
  }
}

function normalizeError(e) {
  if (e instanceof Error) {
    return e;
  }

  if (e && typeof e === 'object') {
    if (e.message) {
      return Object.assign(new Error(e.message), e);
    }
    try {
      return new Error(JSON.stringify(e));
    } catch (serErr) {
      return new Error(`Couldn't normalize error ${String(e)}: ${serErr}`);
    }
  }

  return new Error(`Can't normalize error ${String(e)}`);
}

module.exports = ErrorHandler;
