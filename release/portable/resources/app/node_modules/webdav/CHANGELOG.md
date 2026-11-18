# WebDAV-Client changelog

## v5.6.0
_2024-04-24_

 * Switch to `entities` over `he`
 * **Bugfixes**
   * [#366](https://github.com/perry-mitchell/webdav-client/issues/366) React-native import not working

## v5.5.0
_2024-03-18_

 * [#303](https://github.com/perry-mitchell/webdav-client/issues/303) Partially update file contents
 * [#329](https://github.com/perry-mitchell/webdav-client/issues/329) Overwrite option for copy/move file
 * [#369](https://github.com/perry-mitchell/webdav-client/issues/369) Automatic auth mode

## v5.4.0
_2024-02-24_

 * [#359](https://github.com/perry-mitchell/webdav-client/issues/359) React-Native specific build
 * Updated dependencies

## v5.3.2
_2024-02-05_

 * **Bugfix**:
   * [#364](https://github.com/perry-mitchell/webdav-client/pull/364) XML entities double decoded

## v5.3.1
_2023-11-27_

 * **Bugfix**:
   * [#360](https://github.com/perry-mitchell/webdav-client/pull/360) Incorrect filename due to mishandling of XML-encoded href

## v5.3.0
_2023-08-30_

 * [#205](https://github.com/perry-mitchell/webdav-client/issues/205) Search method
 * **Bugfix**:
   * [#355](https://github.com/perry-mitchell/webdav-client/issues/355) Can not be imported with newer node versions
   * [#346](https://github.com/perry-mitchell/webdav-client/pull/346) Node import forces use of `esModuleInterop` flag

## v5.2.3
_2023-07-16_

 * React-Native entry in `package.json`

## v5.2.2
_2023-06-29_

 * **Bugfix**:
   * [#339](https://github.com/perry-mitchell/webdav-client/issues/339) Unable to import files from `dist`

## v5.2.1
_2023-06-18_

 * **Bugfix**:
   * [#339](https://github.com/perry-mitchell/webdav-client/issues/339) Regression: `processResponsePayload` and other methods not exposed in exports

## v5.2.0
_2023-06-18_

 * [#344](https://github.com/perry-mitchell/webdav-client/pull/344) Upgrade `fast-xml-parser` to new major (v4)
 * **Bugfix**:
   * [#336](https://github.com/perry-mitchell/webdav-client/issues/336) `fast-xml-parser` vulnerability

## v5.1.0
_2023-05-29_

 * [#342](https://github.com/perry-mitchell/webdav-client/issues/342) Support custom remote base directory (other than path specified in URL): `remoteBasePath`

## v5.0.0
_2022-11-30_

 * **Major release**
   * [#326](https://github.com/perry-mitchell/webdav-client/issues/326) Build output is now ESM only (read [this](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c))
   * ~~[#269](https://github.com/perry-mitchell/webdav-client/issues/269)~~ [#335](https://github.com/perry-mitchell/webdav-client/pull/335) Axios replaced with Fetch
   * [#178](https://github.com/perry-mitchell/webdav-client/issues/178) Support returning current directory info for `getDirectoryContents`
   * [#332](https://github.com/perry-mitchell/webdav-client/issues/332) HA1 support for Digest authentication
 * [#341](https://github.com/perry-mitchell/webdav-client/pull/341) Preserve stringified numbers with leading zeros
 * **Bugfix**:
   * [#204](https://github.com/perry-mitchell/webdav-client/issues/204) Missing engine restriction for Node
   * [#159](https://github.com/perry-mitchell/webdav-client/issues/159) Missing error status code

Breaking changes:

 * Download progress no longer supported (`onDownloadProgress`): [see discussion](https://github.com/perry-mitchell/webdav-client/issues/319#issuecomment-1328323167) 
 * Upload progress no longer supported (`onUploadProgress`): [see discussion](https://github.com/perry-mitchell/webdav-client/issues/319#issuecomment-1328323167)
 * Node request limitations removed: `maxBodyLength` and `maxContentLength` are no longer needed/supported

## v4.11.2
_2022-11-19_

 * **Bugfix**:
   * [#323](https://github.com/perry-mitchell/webdav-client/issues/323) Cannot use namespace `HotPatcher` as a type

## v4.11.1
_2022-11-19_

 * **Bugfix**:
   * [#324](https://github.com/perry-mitchell/webdav-client/pull/324) Missing leading slash causes extra entries in `getDirectoryContents` call

## v4.11.0
_2022-08-21_

 * [#315](https://github.com/perry-mitchell/webdav-client/pull/315) `HotPatcher` intermediate type annotation

## v4.10.0
_2022-05-16_

 * [#291](https://github.com/perry-mitchell/webdav-client/pull/291) Correct string byte size calculations for `Content-Length` headers
 * **Bugfix**:
   * [#304](https://github.com/perry-mitchell/webdav-client/issues/304) React Native `putFileContents` fails with `TypeError: Right-hand side of 'instanceof' is not an object`

## v4.9.0
_2022-04-20_

 * [#237](https://github.com/perry-mitchell/webdav-client/issues/237) `path` support for quota queries
 * **Bugfix**:
   * [#300](https://github.com/perry-mitchell/webdav-client/issues/300) Vulnerable dependency `url-parse`

## v4.8.0
_2022-01-11_

 * [#282](https://github.com/perry-mitchell/webdav-client/issues/282) `onDownloadProgress` option
 * [#285](https://github.com/perry-mitchell/webdav-client/pull/285) `AbortSignal` option support
 * Node engine specified at `>=10`

## v4.7.0
_2021-08-27_

 * [#65](https://github.com/perry-mitchell/webdav-client/issues/65) Lock / Unlock methods

## v4.6.1
_2021-08-14_

 * **Bugfix**:
   * [#267](https://github.com/perry-mitchell/webdav-client/pull/267) Fix `getFileContents` string handling of remote JSON files

## v4.6.0
_2021-05-21_

 * `response` property on `WebDAVClientError` instances ([#261](https://github.com/perry-mitchell/webdav-client/issues/261))

## v4.5.0
_2021-05-17_

 * Update dependencies - Webpack v5
 * **Bugfix**:
   * [#263](https://github.com/perry-mitchell/webdav-client/pull/263) Fix `putFileContents` `onUploadProgress` callback option

## v4.4.0
_2021-05-09_

 * [#259](https://github.com/perry-mitchell/webdav-client/pull/259) Ensure correct collection path when creating directory
 * [#258](https://github.com/perry-mitchell/webdav-client/pull/258) Handle prop status code in response when using `stat`

## v4.3.0
_2021-03-28_

 * [#118](https://github.com/perry-mitchell/webdav-client/issues/118) `createDirectory` `recursive` option

## v4.2.1
_2021-03-07_

_Includes a new feature for v4: `data` override option in method options. This missing feature is actually a regression when compared to the v3 code-base, but is now a first-party citizen in v4._

 * **Bugfix**:
   * [#238](https://github.com/perry-mitchell/webdav-client/issues/238) Regression: Not possible to request custom properties in v4

## v4.2.0
_2021-02-18_

 * [#203](https://github.com/perry-mitchell/webdav-client/issues/203) `putFileContents` 412 response handling when `{ overwrite: false }`
 * [#142](https://github.com/perry-mitchell/webdav-client/issues/142) Callbacks with `response`s for `createReadStream` and `createWriteStream`
 * [#31](https://github.com/perry-mitchell/webdav-client/issues/31) Errors thrown for range requests that don't return `206 Partial Content`

## v4.1.0
_2021-02-15_

 * Overridable `headers` option for most methods
 * Set and get base client headers via `setHeaders` and `getHeaders`

## v4.0.0
_2021-02-01_

 * **Major release**
   * Project re-written in **Typescript**

Breaking changes:

 * Authentication is **explicit** in v4, when not using basic/no authentication. [Specify the authentication type](https://github.com/perry-mitchell/webdav-client#authentication--connection) when creating the client.
 * `headers` can be specified when creating a client. These are overridden by method-specific headers when making requests.

## v3.6.2
_2021-01-06_

 * **Bugfixes**:
   * [#231](https://github.com/perry-mitchell/webdav-client/pull/231) Unable to target files using custom request
 * **Security Patches**:
   * [#232](https://github.com/perry-mitchell/webdav-client/issues/232) Axios server-side request forgery vulerability ([CVE-2020-28168](https://github.com/advisories/GHSA-4w2v-q235-vp99))

## v3.6.1
_2020-10-15_

 * **Bugfixes**:
   * [#221](https://github.com/perry-mitchell/webdav-client/issues/221) Stat function erroneously decodes paths with `%` in them

## v3.6.0
_2020-10-12_

 * [#220](https://github.com/perry-mitchell/webdav-client/pull/220) `maxBodyLength` option for changing written files max size
 * **Bugfixes**:
   * [#218](https://github.com/perry-mitchell/webdav-client/issues/218) Invalid response error - No root multistatus

## v3.5.0
_2020-10-08_

 * Upgrade dependencies (major versions)
   * [axios upgrade -> 0.20](https://github.com/axios/axios/blob/master/CHANGELOG.md#0200-august-20-2020)

## v3.4.0
_2020-10-08_

 * **Bugfixes**:
   * [#215](https://github.com/perry-mitchell/webdav-client/pull/215) Excessive memory usage when uploading big files (axios max-redirects)
   * [#213](https://github.com/perry-mitchell/webdav-client/pull/213) `getDirectoryContents` fails for directories with `&` in the name

## v3.3.0
_2020-04-19_

 * Node 10 build configuration
 * [#201](https://github.com/perry-mitchell/webdav-client/pull/201) Improved object merging for configurations (no merging instances)
 * [#200](https://github.com/perry-mitchell/webdav-client/pull/200) `createWriteStream` callback support (when request finishes finishes)
 * Improved filename decoding
 * **Bugfix**:
   * [#198](https://github.com/perry-mitchell/webdav-client/issues/198) Encoded characters in directory contents (HTML entities)

## v3.2.0
_2020-02-05_

 * `exists` method

## v3.1.0
_2020-02-05_

 * Improved parsing logic for more robust handling of various PROPFIND requests
 * **Bugfix**:
   * [#194](https://github.com/perry-mitchell/webdav-client/issues/194) Several properties not defined in directory-contents / stats payloads
   * [#147](https://github.com/perry-mitchell/webdav-client/issues/147) `Content-length` header being attached to stream requests erroneously

## v3.0.0
_2020-01-26_

 * Removed support for NodeJS < 10
 * Web support
 * Replaced XML parsing library (no dependencies, no streaming - better web support)
 * `createReadStream` and `createWriteStream` stubbed but disabled in web version

## v2.10.2
_2020-01-25_

 * **Bugfix**:
   * [#189](https://github.com/perry-mitchell/webdav-client/issues/189) Maximum call stack size exceeded during digest auth usage (property merging)

## v2.10.1
_2019-12-17_

 * **Bugfix**:
   * [#185](https://github.com/perry-mitchell/webdav-client/issues/185) Extra trailing slash after join for URL components on root account requests

## v2.10.0
_2019-10-12_

 * [#174](https://github.com/perry-mitchell/webdav-client/pull/174) `customRequest` method for making custom requests

## v2.9.1
_2019-07-07_

 * [#162](https://github.com/perry-mitchell/webdav-client/issues/162) etag.replace is not a function (etag string validation)

## v2.9.0
_2019-07-07_

 * [#40](https://github.com/perry-mitchell/webdav-client/issues/40) Digest authentication support

## v2.8.0
_2018-05-26_

 * Remove `path` dependency

## v2.7.0
_2019-05-23_

 * [#149](https://github.com/perry-mitchell/webdav-client/issues/149) Upload progress for `putFileContents`
 * [#154](https://github.com/perry-mitchell/webdav-client/pull/154) Normalise MIME type

## v2.6.0
_2019-03-03_

 * [#122](https://github.com/perry-mitchell/webdav-client/issues/122) Glob functionality
 * [#144](https://github.com/perry-mitchell/webdav-client/issues/144) Support uploading larger files

## v2.5.0
_2019-01-24_

 * [#130](https://github.com/perry-mitchell/webdav-client/issues/130) Support for `deep` option on `getDirectoryContents`

## v2.4.0
_2019-01-23_

 * [#132](https://github.com/perry-mitchell/webdav-client/issues/132) ETags in `getDirectoryContents` results and stats

## v2.3.0
_2019-01-22_

 * [#134](https://github.com/perry-mitchell/webdav-client/issues/134) Allow access to all returned properties

## v2.2.1
_2019-01-10_

 * [#121](https://github.com/perry-mitchell/webdav-client/issues/121) Unexpected close tag - trailing slash bug
 * [#127](https://github.com/perry-mitchell/webdav-client/issues/127) Force trailing slash
 * [#126](https://github.com/perry-mitchell/webdav-client/issues/126) `copyFile`: Failed to execute 'setRequestHeader' on 'XMLHttpRequest': Value is not a valid ByteString

## v2.2.0
_2018-12-12_

 * Replace Buffer usage for base64 encoding with `base-64` package

## v2.1.0
_2018-12-12_

 * Move node core imports into functions (downstream compatibility - React Native)
 * Upgrade dependencies

## **v2.0.0**
_2018-11-20_

 * **Major version update!**
   * Fetch has been replaced with Axios! tl;dr `fetch` is horrible when looking to make webdav-client compatible cross-platform. Axios is a great alternative.
   * Detailed responses now available on some methods (providing response headers, for example)

## 1.6.1
_2018-10-06_

 * [#109](https://github.com/perry-mitchell/webdav-client/issues/109) `getDirectoryContents` fails on Seafile responses
 * Remove dependency on just a handful of namespaces for multistatus responses

## 1.6.0
_2018-09-15_

 * Update dependencies, audit vulnerabilities

## 1.5.5
_2018-09-13_

 * [#104](https://github.com/perry-mitchell/webdav-client/issues/104) `path.posix` failed in browserify
 * **Dev**:
   * Webpack & KarmaJS dev testing in Chrome

## 1.5.4
_2018-09-11_

 * [#101](https://github.com/perry-mitchell/webdav-client/issues/101) `getDirectoryContents` fails on windows
 * [#98](https://github.com/perry-mitchell/webdav-client/issues/98) Moving items fails when destination contains spaces

## 1.5.3
_2018-07-07_

 * ([#91](https://github.com/perry-mitchell/webdav-client/issues/91) [#93](https://github.com/perry-mitchell/webdav-client/issues/93)): Bugfix: Encoding issues with special characters

## 1.5.2
_2018-03-25_

 * Fix bug where requesting directory contents at paths with trailing slashes would return parent directory in results

## 1.5.1
_2018-03-23_

 * ([#81](https://github.com/perry-mitchell/webdav-client/issues/81)): Bad encoding when paths are prefixed with directory separator

## 1.5.0
_2018-03-19_

 * Add OAuth2 authentication support (via token)
 * Add `getFileDownloadLink` method

## 1.4.0
_2018-03-13_

 * Add `copyFile` method

## 1.3.0
_2018-03-07_

 * Change `deepmerge` dependency to `merge`
 * ([#79](https://github.com/perry-mitchell/webdav-client/issues/79)): getFileContents arrayBuffer default causes incompatibilities
   * Use `buffer()` where available, and fallback to `arrayBuffer()` otherwise

## 1.2.1
_2018-02-26_

 * Downgrade `deepmerge` to 1.5.2 to fix Webpack bug

## 1.2.0
_2018-02-24_

 * ([#74](https://github.com/perry-mitchell/webdav-client/issues/74)): TypeError: res.buffer is not a function (`ArrayBuffer` replaces `Buffer` for node-fetch)
 * ([#66](https://github.com/perry-mitchell/webdav-client/issues/66)): Special characters break output (unicode/non-latin encoding)

## 1.1.2
_2018-02-21_

 * Development bug fixes

## 1.1.1

**Bugfixes**:

 * ([#68](https://github.com/perry-mitchell/webdav-client/issues/68)): Fetched directory appearing in results

## 1.1.0
_2017-08-30_

 * Add transpilation process for published library

## 1.0.1
_2017-08-07_

 * Allow `test/` directory during publish (used downstream)

## **1.0.0**
_2017-08-06_

 * Complete rewrite of the project
 * Better testing setup with webdav-server
 * **Bugfixes**:
   * [Directory contents parse bug](https://github.com/perry-mitchell/webdav-client/issues/54)

## 1.0.0-rc1
_2017-07-01_

 * URI encoding for special characters
 * Writeable streams
 * Internal `fetch` override support
 * Quota support
 * Remove duplicate methods
 * Optimise `stat` depth

## 0.10.0
_2017-06-24_

 * Disable native `window.fetch` in browsers

## 0.9.0
_2017-06-07_

 * Add support for ranges with only `start`

## 0.8.0
_2017-06-07_

 * Add stream support (GET)
 * Add `createReadStream` method
 * Add `getFileStream` method
 * Update option merging behaviour for default values

## 0.7.0
_2017-06-03_

 * Remove lodash (performance improvement)

## 0.6.0
_2017-04-13_

 * Support for non-prefixed XML elements in WebDAV response
 * HTTP status code for thrown exceptions

## 0.5.0
_2017-02-11_

 * Use `window.fetch` when available in browser

## 0.4.1
_2017-02-04_

 * Fix `putFileContents` authorisation bug

## 0.4.0
_2017-01-29_

 * Add `options` argument to all methods, allowing custom headers
 * **(Breaking)**
   * Move `format` arguments to `options` object
   * Removed node 0.12 support

## 0.3.1
_2017-01-18_

 * Remove node querystring calls for downstream compat

## 0.2.0
_2017-01-03_

 * Added `options` parameter to `putFileContents`

## 0.1.1
_2016_10_24_

 * Fixed username/password authentication with special characters

## 0.1.0
_2016-10-13_

 * Initial release
