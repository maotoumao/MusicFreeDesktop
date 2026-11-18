var Stream = require('stream');
var Promise = require('bluebird');
var util = require('util');
var strFunction = 'function';

function PullStream() {
  if (!(this instanceof PullStream))
    return new PullStream();

  Stream.Duplex.call(this,{decodeStrings:false, objectMode:true});
  this.buffer = Buffer.from('');
  var self = this;
  self.on('finish',function() {
    self.finished = true;
    self.emit('chunk',false);
  });
}

util.inherits(PullStream,Stream.Duplex);

PullStream.prototype._write = function(chunk,e,cb) {
  this.buffer = Buffer.concat([this.buffer,chunk]);
  this.cb = cb;
  this.emit('chunk');
};


// The `eof` parameter is interpreted as `file_length` if the type is number
// otherwise (i.e. buffer) it is interpreted as a pattern signaling end of stream
PullStream.prototype.stream = function(eof,includeEof) {
  var p = Stream.PassThrough();
  var done,self= this;

  function cb() {
    if (typeof self.cb === strFunction) {
      var callback = self.cb;
      self.cb = undefined;
      return callback();
    }
  }

  function pull() {
    var packet;
    if (self.buffer && self.buffer.length) {
      if (typeof eof === 'number') {
        packet = self.buffer.slice(0,eof);
        self.buffer = self.buffer.slice(eof);
        eof -= packet.length;
        done = done || !eof;
      } else {
        var match = self.buffer.indexOf(eof);
        if (match !== -1) {
          // store signature match byte offset to allow us to reference
          // this for zip64 offset
          self.match = match
          if (includeEof) match = match + eof.length;
          packet = self.buffer.slice(0,match);
          self.buffer = self.buffer.slice(match);
          done = true;
        } else {
          var len = self.buffer.length - eof.length;
          if (len <= 0) {
            cb();
          } else {
            packet = self.buffer.slice(0,len);
            self.buffer = self.buffer.slice(len);
          }
        }
      }
      if (packet) p.write(packet,function() {
        if (self.buffer.length === 0 || (eof.length && self.buffer.length <= eof.length)) cb();
      });
    }
    
    if (!done) {
      if (self.finished) {
        self.removeListener('chunk',pull);
        self.emit('error', new Error('FILE_ENDED'));
        return;
      }
      
    } else {
      self.removeListener('chunk',pull);
      p.end();
    }
  }

  self.on('chunk',pull);
  pull();
  return p;
};

PullStream.prototype.pull = function(eof,includeEof) {
  if (eof === 0) return Promise.resolve('');

  // If we already have the required data in buffer
  // we can resolve the request immediately
  if (!isNaN(eof) && this.buffer.length > eof) {
    var data = this.buffer.slice(0,eof);
    this.buffer = this.buffer.slice(eof);
    return Promise.resolve(data);
  }

  // Otherwise we stream until we have it
  var buffer = Buffer.from(''),
      self = this;

  var concatStream = Stream.Transform();
  concatStream._transform = function(d,e,cb) {
    buffer = Buffer.concat([buffer,d]);
    cb();
  };
  
  var rejectHandler;
  var pullStreamRejectHandler;
  return new Promise(function(resolve,reject) {
    rejectHandler = reject;
    pullStreamRejectHandler = function(e) {
      self.__emittedError = e;
      reject(e);
    }
    if (self.finished)
      return reject(new Error('FILE_ENDED'));
    self.once('error',pullStreamRejectHandler);  // reject any errors from pullstream itself
    self.stream(eof,includeEof)
      .on('error',reject)
      .pipe(concatStream)
      .on('finish',function() {resolve(buffer);})
      .on('error',reject);
  })
  .finally(function() {
    self.removeListener('error',rejectHandler);
    self.removeListener('error',pullStreamRejectHandler);
  });
};

PullStream.prototype._read = function(){};

module.exports = PullStream;
