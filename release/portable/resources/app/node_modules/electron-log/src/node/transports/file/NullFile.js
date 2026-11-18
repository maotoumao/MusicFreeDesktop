'use strict';

const File = require('./File');

class NullFile extends File {
  clear() {

  }

  crop() {

  }

  getSize() {
    return 0;
  }

  isNull() {
    return true;
  }

  writeLine() {

  }
}

module.exports = NullFile;
