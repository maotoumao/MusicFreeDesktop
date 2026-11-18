[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![code coverage](https://zjonsson.github.io/node-unzipper/badge.svg)](https://zjonsson.github.io/node-unzipper/) 

[npm-image]: https://img.shields.io/npm/v/unzipper.svg
[npm-url]: https://npmjs.org/package/unzipper
[travis-image]: https://api.travis-ci.org/ZJONSSON/node-unzipper.png?branch=master
[travis-url]: https://travis-ci.org/ZJONSSON/node-unzipper?branch=master
[downloads-image]: https://img.shields.io/npm/dm/unzipper.svg
[downloads-url]: https://npmjs.org/package/unzipper
[coverage-image]: https://3tjjj5abqi.execute-api.us-east-1.amazonaws.com/prod/node-unzipper/badge
[coverage-url]: https://3tjjj5abqi.execute-api.us-east-1.amazonaws.com/prod/node-unzipper/url

# unzipper

This is an active fork and drop-in replacement of the [node-unzip](https://github.com/EvanOxfeld/node-unzip) and addresses the following issues:
* finish/close events are not always triggered, particular when the input stream is slower than the receivers
* Any files are buffered into memory before passing on to entry

The structure of this fork is similar to the original, but uses Promises and inherit guarantees provided by node streams to ensure low memory footprint and emits finish/close events at the end of processing.   The new `Parser` will push any parsed `entries` downstream if you pipe from it, while still supporting the legacy `entry` event as well.

Breaking changes: The new `Parser` will not automatically drain entries if there are no listeners or pipes in place.

Unzipper provides simple APIs similar to [node-tar](https://github.com/isaacs/node-tar) for parsing and extracting zip files.
There are no added compiled dependencies - inflation is handled by node.js's built in zlib support.

Please note:  Methods that use the Central Directory instead of parsing entire file can be found under [`Open`](#open)

Chrome extension files (.crx) are zipfiles with an [extra header](http://www.adambarth.com/experimental/crx/docs/crx.html) at the start of the file.  Unzipper will parse .crx file with the streaming methods (`Parse` and `ParseOne`).  The `Open` methods will check for `crx` headers and parse crx files, but only if you provide `crx: true` in options.

## Installation

```bash
$ npm install unzipper
```

## Quick Examples

### Extract to a directory
```js
fs.createReadStream('path/to/archive.zip')
  .pipe(unzipper.Extract({ path: 'output/path' }));
```

Extract emits the 'close' event once the zip's contents have been fully extracted to disk. `Extract` uses [fstream.Writer](https://www.npmjs.com/package/fstream) and therefore needs an absolute path to the destination directory.  This directory will be automatically created if it doesn't already exist.

### Parse zip file contents

Process each zip file entry or pipe entries to another stream.

__Important__: If you do not intend to consume an entry stream's raw data, call autodrain() to dispose of the entry's
contents. Otherwise the stream will halt.   `.autodrain()` returns an empty stream that provides `error` and `finish` events.
Additionally you can call `.autodrain().promise()` to get the promisified version of success or failure of the autodrain.

```js
// If you want to handle autodrain errors you can either:
entry.autodrain().catch(e => handleError);
// or
entry.autodrain().on('error' => handleError);
```

Here is a quick example:

```js
fs.createReadStream('path/to/archive.zip')
  .pipe(unzipper.Parse())
  .on('entry', function (entry) {
    const fileName = entry.path;
    const type = entry.type; // 'Directory' or 'File'
    const size = entry.vars.uncompressedSize; // There is also compressedSize;
    if (fileName === "this IS the file I'm looking for") {
      entry.pipe(fs.createWriteStream('output/path'));
    } else {
      entry.autodrain();
    }
  });
```

and the same example using async iterators:

```js
const zip = fs.createReadStream('path/to/archive.zip').pipe(unzipper.Parse({forceStream: true}));
for await (const entry of zip) {
  const fileName = entry.path;
  const type = entry.type; // 'Directory' or 'File'
  const size = entry.vars.uncompressedSize; // There is also compressedSize;
  if (fileName === "this IS the file I'm looking for") {
    entry.pipe(fs.createWriteStream('output/path'));
  } else {
    entry.autodrain();
  }
}
```

### Parse zip by piping entries downstream

If you `pipe` from unzipper the downstream components will receive each `entry` for further processing.   This allows for clean pipelines transforming zipfiles into unzipped data.

Example using `stream.Transform`:

```js
fs.createReadStream('path/to/archive.zip')
  .pipe(unzipper.Parse())
  .pipe(stream.Transform({
    objectMode: true,
    transform: function(entry,e,cb) {
      const fileName = entry.path;
      const type = entry.type; // 'Directory' or 'File'
      const size = entry.vars.uncompressedSize; // There is also compressedSize;
      if (fileName === "this IS the file I'm looking for") {
        entry.pipe(fs.createWriteStream('output/path'))
          .on('finish',cb);
      } else {
        entry.autodrain();
        cb();
      }
    }
  }
  }));
```

Example using [etl](https://www.npmjs.com/package/etl):

```js
fs.createReadStream('path/to/archive.zip')
  .pipe(unzipper.Parse())
  .pipe(etl.map(entry => {
    if (entry.path == "this IS the file I'm looking for")
      return entry
        .pipe(etl.toFile('output/path'))
        .promise();
    else
      entry.autodrain();
  }))

```

### Parse a single file and pipe contents

`unzipper.parseOne([regex])` is a convenience method that unzips only one file from the archive and pipes the contents down (not the entry itself).  If no search criteria is specified, the first file in the archive will be unzipped.  Otherwise, each filename will be compared to the criteria and the first one to match will be unzipped and piped down.  If no file matches then the the stream will end without any content.

Example:

```js
fs.createReadStream('path/to/archive.zip')
  .pipe(unzipper.ParseOne())
  .pipe(fs.createWriteStream('firstFile.txt'));
```

### Buffering the content of an entry into memory

While the recommended strategy of consuming the unzipped contents is using streams, it is sometimes convenient to be able to get the full buffered contents of each file .  Each `entry` provides a `.buffer` function that consumes the entry by buffering the contents into memory and returning a promise to the complete buffer.

```js
fs.createReadStream('path/to/archive.zip')
  .pipe(unzipper.Parse())
  .pipe(etl.map(async entry => {
    if (entry.path == "this IS the file I'm looking for") {
      const content = await entry.buffer();
      await fs.writeFile('output/path',content);
    }
    else {
      entry.autodrain();
    }
  }))
```

### Parse.promise() syntax sugar

The parser emits `finish` and `error` events like any other stream.  The parser additionally provides a promise wrapper around those two events to allow easy folding into existing Promise-based structures.

Example:

```js
fs.createReadStream('path/to/archive.zip')
  .pipe(unzipper.Parse())
  .on('entry', entry => entry.autodrain())
  .promise()
  .then( () => console.log('done'), e => console.log('error',e));
```

### Parse zip created by DOS ZIP or Windows ZIP Folders

Archives created by legacy tools usually have filenames encoded with IBM PC (Windows OEM) character set.
You can decode filenames with preferred character set:

```js
const il = require('iconv-lite');
fs.createReadStream('path/to/archive.zip')
  .pipe(unzipper.Parse())
  .on('entry', function (entry) {
    // if some legacy zip tool follow ZIP spec then this flag will be set
    const isUnicode = entry.props.flags.isUnicode;
    // decode "non-unicode" filename from OEM Cyrillic character set
    const fileName = isUnicode ? entry.path : il.decode(entry.props.pathBuffer, 'cp866');
    const type = entry.type; // 'Directory' or 'File'
    const size = entry.vars.uncompressedSize; // There is also compressedSize;
    if (fileName === "Текстовый файл.txt") {
      entry.pipe(fs.createWriteStream(fileName));
    } else {
      entry.autodrain();
    }
  });
```

## Open
Previous methods rely on the entire zipfile being received through a pipe.  The Open methods load take a different approach: load the central directory first (at the end of the zipfile) and provide the ability to pick and choose which zipfiles to extract, even extracting them in parallel.   The open methods return a promise on the contents of the directory, with individual `files` listed in an array.   Each file element has the following methods:
* `stream([password])` - returns a stream of the unzipped content which can be piped to any destination
* `buffer([password])` - returns a promise on the buffered content of the file.
If the file is encrypted you will have to supply a password to decrypt, otherwise you can leave blank.
Unlike `adm-zip` the Open methods will never read the entire zipfile into buffer.

The last argument is optional `options` object where you can specify `tailSize` (default 80 bytes), i.e. how many bytes should we read at the end of the zipfile to locate the endOfCentralDirectory.  This location can be variable depending on zip64 extensible data sector size.   Additionally you can supply option `crx: true` which will check for a crx header and parse the file accordingly by shifting all file offsets by the length of the crx header.

### Open.file([path], [options])
Returns a Promise to the central directory information with methods to extract individual files.   `start` and `end` options are used to avoid reading the whole file.

Example:
```js
async function main() {
  const directory = await unzipper.Open.file('path/to/archive.zip');
  console.log('directory', directory);
  return new Promise( (resolve, reject) => {
    directory.files[0]
      .stream()
      .pipe(fs.createWriteStream('firstFile'))
      .on('error',reject)
      .on('finish',resolve)
  });
}

main();
```

### Open.url([requestLibrary], [url | params], [options])
This function will return a Promise to the central directory information from a URL point to a zipfile.  Range-headers are used to avoid reading the whole file. Unzipper does not ship with a request library so you will have to provide it as the first option.

Live Example: (extracts a tiny xml file from the middle of a 500MB zipfile)

```js
const request = require('request');
const unzipper = require('./unzip');

async function main() {
  const directory = await unzipper.Open.url(request,'http://www2.census.gov/geo/tiger/TIGER2015/ZCTA5/tl_2015_us_zcta510.zip');
  const file = directory.files.find(d => d.path === 'tl_2015_us_zcta510.shp.iso.xml');
  const content = await file.buffer();
  console.log(content.toString());
}

main();
```


This function takes a second parameter which can either be a string containing the `url` to request, or an `options` object to invoke the supplied `request` library with. This can be used when other request options are required, such as custom headers or authentication to a third party service.

```js
const request = require('google-oauth-jwt').requestWithJWT();

const googleStorageOptions = {
  url: `https://www.googleapis.com/storage/v1/b/m-bucket-name/o/my-object-name`,
  qs: { alt: 'media' },
  jwt: {
      email: google.storage.credentials.client_email,
      key: google.storage.credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/devstorage.read_only']
  }
});

async function getFile(req, res, next) {
  const directory = await unzipper.Open.url(request, googleStorageOptions);
  const file = zip.files.find((file) => file.path === 'my-filename');
  return file.stream().pipe(res);
});
```

### Open.s3([aws-sdk], [params], [options])
This function will return a Promise to the central directory information from a zipfile on S3.  Range-headers are used to avoid reading the whole file.    Unzipper does not ship with with the aws-sdk so you have to provide an instantiated client as first arguments.    The params object requires `Bucket` and `Key` to fetch the correct file.

Example:

```js
const unzipper = require('./unzip');
const AWS = require('aws-sdk');
const s3Client = AWS.S3(config);

async function main() {
  const directory = await unzipper.Open.s3(s3Client,{Bucket: 'unzipper', Key: 'archive.zip'});
  return new Promise( (resolve, reject) => {
    directory.files[0]
      .stream()
      .pipe(fs.createWriteStream('firstFile'))
      .on('error',reject)
      .on('finish',resolve)
  });
}

main();
```

### Open.buffer(buffer, [options])
If you already have the zip file in-memory as a buffer, you can open the contents directly.

Example:

```js
// never use readFileSync - only used here to simplify the example
const buffer = fs.readFileSync('path/to/arhive.zip');

async function main() {
  const directory = await unzipper.Open.buffer(buffer);
  console.log('directory',directory);
  // ...
}

main();
```

### Open.custom(source, [options])
This function can be used to provide a custom source implementation. The source parameter expects a `stream` and a `size` function to be implemented. The size function should return a `Promise` that resolves the total size of the file. The stream function should return a `Readable` stream according to the supplied offset and length parameters.

Example:

```js
// Custom source implementation for reading a zip file from Google Cloud Storage
const { Storage } = require('@google-cloud/storage');

async function main() {
  const storage = new Storage();
  const bucket = storage.bucket('my-bucket');
  const zipFile = bucket.file('my-zip-file.zip');
  
  const customSource = {
    stream: function(offset, length) {
      return zipFile.createReadStream({
        start: offset,
        end: length && offset + length
      })
    },
    size: async function() {
      const objMetadata = (await zipFile.getMetadata())[0];
      return objMetadata.size;
    }
  };

  const directory = await unzipper.Open.custom(customSource);
  console.log('directory', directory);
  // ...
}

main();
```

### Open.[method].extract()

The directory object returned from `Open.[method]` provides an `extract` method which extracts all the files to a specified `path`, with an optional `concurrency` (default: 1).

Example (with concurrency of 5):

```js
unzip.Open.file('path/to/archive.zip')
  .then(d => d.extract({path: '/extraction/path', concurrency: 5}));
```

## Licenses
See LICENCE
