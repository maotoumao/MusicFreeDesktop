'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const File = require('./File');
const NullFile = require('./NullFile');

class FileRegistry extends EventEmitter {
  store = {};

  constructor() {
    super();
    this.emitError = this.emitError.bind(this);
  }

  /**
   * Provide a File object corresponding to the filePath
   * @param {string} filePath
   * @param {WriteOptions} [writeOptions]
   * @param {boolean} [writeAsync]
   * @return {File}
   */
  provide({ filePath, writeOptions = {}, writeAsync = false }) {
    let file;
    try {
      filePath = path.resolve(filePath);

      if (this.store[filePath]) {
        return this.store[filePath];
      }

      file = this.createFile({ filePath, writeOptions, writeAsync });
    } catch (e) {
      file = new NullFile({ path: filePath });
      this.emitError(e, file);
    }

    file.on('error', this.emitError);
    this.store[filePath] = file;
    return file;
  }

  /**
   * @param {string} filePath
   * @param {WriteOptions} writeOptions
   * @param {boolean} async
   * @return {File}
   * @private
   */
  createFile({ filePath, writeOptions, writeAsync }) {
    this.testFileWriting({ filePath, writeOptions });
    return new File({ path: filePath, writeOptions, writeAsync });
  }

  /**
   * @param {Error} error
   * @param {File} file
   * @private
   */
  emitError(error, file) {
    this.emit('error', error, file);
  }

  /**
   * @param {string} filePath
   * @param {WriteOptions} writeOptions
   * @private
   */
  testFileWriting({ filePath, writeOptions }) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '', { flag: 'a', mode: writeOptions.mode });
  }
}

module.exports = FileRegistry;
