var fs = require('graceful-fs');
var Promise = require('bluebird');
var directory = require('./directory');
var Stream = require('stream');

module.exports = {
  buffer: function(buffer, options) {
    var source = {
      stream: function(offset, length) {
        var stream = Stream.PassThrough();
        var end = length ? offset + length : undefined;
        stream.end(buffer.slice(offset, end));
        return stream;
      },
      size: function() {
        return Promise.resolve(buffer.length);
      }
    };
    return directory(source, options);
  },
  file: function(filename, options) {
    var source = {
      stream: function(start,length) {
        var end = length ? start + length : undefined;
        return fs.createReadStream(filename,{start, end});
      },
      size: function() {
        return new Promise(function(resolve,reject) {
          fs.stat(filename,function(err,d) {
            if (err)
              reject(err);
            else
              resolve(d.size);
          });
        });
      }
    };
    return directory(source, options);
  },

  url: function(request, params, options) {
    if (typeof params === 'string')
      params = {url: params};
    if (!params.url)
      throw 'URL missing';
    params.headers = params.headers || {};

    var source = {
      stream : function(offset,length) {
        var options = Object.create(params);
        var end = length ? offset + length : '';
        options.headers = Object.create(params.headers);
        options.headers.range = 'bytes='+offset+'-' + end;
        return request(options);
      },
      size: function() {
        return new Promise(function(resolve,reject) {
          var req = request(params);
          req.on('response',function(d) {
            req.abort();
            if (!d.headers['content-length'])
              reject(new Error('Missing content length header'));
            else
              resolve(d.headers['content-length']);
          }).on('error',reject);
        });
      }
    };

    return directory(source, options);
  },

  s3 : function(client,params, options) {
    var source = {
      size: function() {
        return new Promise(function(resolve,reject) {
          client.headObject(params, function(err,d) {
            if (err)
              reject(err);
            else
              resolve(d.ContentLength);
          });
        });
      },
      stream: function(offset,length) {
        var d = {};
        for (var key in params)
          d[key] = params[key];
        var end = length ? offset + length : '';
        d.Range = 'bytes='+offset+'-' + end;
        return client.getObject(d).createReadStream();
      }
    };

    return directory(source, options);
  },

  custom: function(source, options) {
    return directory(source, options);
  }
};
