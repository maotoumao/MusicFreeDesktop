'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const os = require('os');

class File extends EventEmitter {
  asyncWriteQueue = [];
  bytesWritten = 0;
  hasActiveAsyncWriting = false;
  path = null;
  initialSize = undefined;
  writeOptions = null;
  writeAsync = false;

  constructor({
    path,
    writeOptions = { encoding: 'utf8', flag: 'a', mode: 0o666 },
    writeAsync = false,
  }) {
    super();

    this.path = path;
    this.writeOptions = writeOptions;
    this.writeAsync = writeAsync;
  }

  get size() {
    return this.getSize();
  }

  clear() {
    try {
      fs.writeFileSync(this.path, '', {
        mode: this.writeOptions.mode,
        flag: 'w',
      });
      this.reset();
      return true;
    } catch (e) {
      if (e.code === 'ENOENT') {
        return true;
      }

      this.emit('error', e, this);
      return false;
    }
  }

  crop(bytesAfter) {
    try {
      const content = readFileSyncFromEnd(this.path, bytesAfter || 4096);
      this.clear();
      this.writeLine(`[log cropped]${os.EOL}${content}`);
    } catch (e) {
      this.emit(
        'error',
        new Error(`Couldn't crop file ${this.path}. ${e.message}`),
        this,
      );
    }
  }

  getSize() {
    if (this.initialSize === undefined) {
      try {
        const stats = fs.statSync(this.path);
        this.initialSize = stats.size;
      } catch (e) {
        this.initialSize = 0;
      }
    }

    return this.initialSize + this.bytesWritten;
  }

  increaseBytesWrittenCounter(text) {
    this.bytesWritten += Buffer.byteLength(text, this.writeOptions.encoding);
  }

  isNull() {
    return false;
  }

  nextAsyncWrite() {
    const file = this;

    if (this.hasActiveAsyncWriting || this.asyncWriteQueue.length === 0) {
      return;
    }

    const text = this.asyncWriteQueue.join('');
    this.asyncWriteQueue = [];
    this.hasActiveAsyncWriting = true;

    fs.writeFile(this.path, text, this.writeOptions, (e) => {
      file.hasActiveAsyncWriting = false;

      if (e) {
        file.emit(
          'error',
          new Error(`Couldn't write to ${file.path}. ${e.message}`),
          this,
        );
      } else {
        file.increaseBytesWrittenCounter(text);
      }

      file.nextAsyncWrite();
    });
  }

  reset() {
    this.initialSize = undefined;
    this.bytesWritten = 0;
  }

  toString() {
    return this.path;
  }

  writeLine(text) {
    text += os.EOL;

    if (this.writeAsync) {
      this.asyncWriteQueue.push(text);
      this.nextAsyncWrite();
      return;
    }

    try {
      fs.writeFileSync(this.path, text, this.writeOptions);
      this.increaseBytesWrittenCounter(text);
    } catch (e) {
      this.emit(
        'error',
        new Error(`Couldn't write to ${this.path}. ${e.message}`),
        this,
      );
    }
  }
}

module.exports = File;

function readFileSyncFromEnd(filePath, bytesCount) {
  const buffer = Buffer.alloc(bytesCount);
  const stats = fs.statSync(filePath);

  const readLength = Math.min(stats.size, bytesCount);
  const offset = Math.max(0, stats.size - bytesCount);

  const fd = fs.openSync(filePath, 'r');
  const totalBytes = fs.readSync(fd, buffer, 0, readLength, offset);
  fs.closeSync(fd);

  return buffer.toString('utf8', 0, totalBytes);
}
