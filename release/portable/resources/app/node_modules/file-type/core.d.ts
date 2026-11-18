import type {Readable as ReadableStream} from 'node:stream';
import type {ITokenizer} from 'strtok3';

export type FileExtension =
	| 'jpg'
	| 'png'
	| 'apng'
	| 'gif'
	| 'webp'
	| 'flif'
	| 'xcf'
	| 'cr2'
	| 'cr3'
	| 'orf'
	| 'arw'
	| 'dng'
	| 'nef'
	| 'rw2'
	| 'raf'
	| 'tif'
	| 'bmp'
	| 'icns'
	| 'jxr'
	| 'psd'
	| 'indd'
	| 'zip'
	| 'tar'
	| 'rar'
	| 'gz'
	| 'bz2'
	| '7z'
	| 'dmg'
	| 'mp4'
	| 'mid'
	| 'mkv'
	| 'webm'
	| 'mov'
	| 'avi'
	| 'mpg'
	| 'mp2'
	| 'mp3'
	| 'm4a'
	| 'ogg'
	| 'opus'
	| 'flac'
	| 'wav'
	| 'qcp'
	| 'amr'
	| 'pdf'
	| 'epub'
	| 'mobi'
	| 'elf'
	| 'macho'
	| 'exe'
	| 'swf'
	| 'rtf'
	| 'woff'
	| 'woff2'
	| 'eot'
	| 'ttf'
	| 'otf'
	| 'ico'
	| 'flv'
	| 'ps'
	| 'xz'
	| 'sqlite'
	| 'nes'
	| 'crx'
	| 'xpi'
	| 'cab'
	| 'deb'
	| 'ar'
	| 'rpm'
	| 'Z'
	| 'lz'
	| 'cfb'
	| 'mxf'
	| 'mts'
	| 'wasm'
	| 'blend'
	| 'bpg'
	| 'docx'
	| 'pptx'
	| 'xlsx'
	| '3gp'
	| '3g2'
	| 'j2c'
	| 'jp2'
	| 'jpm'
	| 'jpx'
	| 'mj2'
	| 'aif'
	| 'odt'
	| 'ods'
	| 'odp'
	| 'xml'
	| 'heic'
	| 'cur'
	| 'ktx'
	| 'ape'
	| 'wv'
	| 'asf'
	| 'dcm'
	| 'mpc'
	| 'ics'
	| 'glb'
	| 'pcap'
	| 'dsf'
	| 'lnk'
	| 'alias'
	| 'voc'
	| 'ac3'
	| 'm4b'
	| 'm4p'
	| 'm4v'
	| 'f4a'
	| 'f4b'
	| 'f4p'
	| 'f4v'
	| 'mie'
	| 'ogv'
	| 'ogm'
	| 'oga'
	| 'spx'
	| 'ogx'
	| 'arrow'
	| 'shp'
	| 'aac'
	| 'mp1'
	| 'it'
	| 's3m'
	| 'xm'
	| 'ai'
	| 'skp'
	| 'avif'
	| 'eps'
	| 'lzh'
	| 'pgp'
	| 'asar'
	| 'stl'
	| 'chm'
	| '3mf'
	| 'zst'
	| 'jxl'
	| 'vcf'
	| 'jls'
	| 'pst'
	| 'dwg'
	| 'parquet'
	| 'class'
	| 'arj'
	| 'cpio'
	| 'ace'
	| 'avro'
	| 'icc'
	| 'fbx'
	; // eslint-disable-line semi-style

export type MimeType =
	| 'image/jpeg'
	| 'image/png'
	| 'image/gif'
	| 'image/webp'
	| 'image/flif'
	| 'image/x-xcf'
	| 'image/x-canon-cr2'
	| 'image/x-canon-cr3'
	| 'image/tiff'
	| 'image/bmp'
	| 'image/icns'
	| 'image/vnd.ms-photo'
	| 'image/vnd.adobe.photoshop'
	| 'application/x-indesign'
	| 'application/epub+zip'
	| 'application/x-xpinstall'
	| 'application/vnd.oasis.opendocument.text'
	| 'application/vnd.oasis.opendocument.spreadsheet'
	| 'application/vnd.oasis.opendocument.presentation'
	| 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	| 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
	| 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	| 'application/zip'
	| 'application/x-tar'
	| 'application/x-rar-compressed'
	| 'application/gzip'
	| 'application/x-bzip2'
	| 'application/x-7z-compressed'
	| 'application/x-apple-diskimage'
	| 'video/mp4'
	| 'audio/midi'
	| 'video/x-matroska'
	| 'video/webm'
	| 'video/quicktime'
	| 'video/vnd.avi'
	| 'audio/vnd.wave'
	| 'audio/qcelp'
	| 'audio/x-ms-asf'
	| 'video/x-ms-asf'
	| 'application/vnd.ms-asf'
	| 'video/mpeg'
	| 'video/3gpp'
	| 'audio/mpeg'
	| 'audio/mp4' // RFC 4337
	| 'audio/opus'
	| 'video/ogg'
	| 'audio/ogg'
	| 'application/ogg'
	| 'audio/x-flac'
	| 'audio/ape'
	| 'audio/wavpack'
	| 'audio/amr'
	| 'application/pdf'
	| 'application/x-elf'
	| 'application/x-mach-binary'
	| 'application/x-msdownload'
	| 'application/x-shockwave-flash'
	| 'application/rtf'
	| 'application/wasm'
	| 'font/woff'
	| 'font/woff2'
	| 'application/vnd.ms-fontobject'
	| 'font/ttf'
	| 'font/otf'
	| 'image/x-icon'
	| 'video/x-flv'
	| 'application/postscript'
	| 'application/eps'
	| 'application/x-xz'
	| 'application/x-sqlite3'
	| 'application/x-nintendo-nes-rom'
	| 'application/x-google-chrome-extension'
	| 'application/vnd.ms-cab-compressed'
	| 'application/x-deb'
	| 'application/x-unix-archive'
	| 'application/x-rpm'
	| 'application/x-compress'
	| 'application/x-lzip'
	| 'application/x-cfb'
	| 'application/x-mie'
	| 'application/x-apache-arrow'
	| 'application/mxf'
	| 'video/mp2t'
	| 'application/x-blender'
	| 'image/bpg'
	| 'image/j2c'
	| 'image/jp2'
	| 'image/jpx'
	| 'image/jpm'
	| 'image/mj2'
	| 'audio/aiff'
	| 'application/xml'
	| 'application/x-mobipocket-ebook'
	| 'image/heif'
	| 'image/heif-sequence'
	| 'image/heic'
	| 'image/heic-sequence'
	| 'image/ktx'
	| 'application/dicom'
	| 'audio/x-musepack'
	| 'text/calendar'
	| 'text/vcard'
	| 'model/gltf-binary'
	| 'application/vnd.tcpdump.pcap'
	| 'audio/x-dsf' // Non-standard
	| 'application/x.ms.shortcut' // Invented by us
	| 'application/x.apple.alias' // Invented by us
	| 'audio/x-voc'
	| 'audio/vnd.dolby.dd-raw'
	| 'audio/x-m4a'
	| 'image/apng'
	| 'image/x-olympus-orf'
	| 'image/x-sony-arw'
	| 'image/x-adobe-dng'
	| 'image/x-nikon-nef'
	| 'image/x-panasonic-rw2'
	| 'image/x-fujifilm-raf'
	| 'video/x-m4v'
	| 'video/3gpp2'
	| 'application/x-esri-shape'
	| 'audio/aac'
	| 'audio/x-it'
	| 'audio/x-s3m'
	| 'audio/x-xm'
	| 'video/MP1S'
	| 'video/MP2P'
	| 'application/vnd.sketchup.skp'
	| 'image/avif'
	| 'application/x-lzh-compressed'
	| 'application/pgp-encrypted'
	| 'application/x-asar'
	| 'model/stl'
	| 'application/vnd.ms-htmlhelp'
	| 'model/3mf'
	| 'image/jxl'
	| 'application/zstd'
	| 'image/jls'
	| 'application/vnd.ms-outlook'
	| 'image/vnd.dwg'
	| 'application/x-parquet'
	| 'application/java-vm'
	| 'application/x-arj'
	| 'application/x-cpio'
	| 'application/x-ace-compressed'
	| 'application/avro'
	| 'application/vnd.iccprofile'
	| 'application/x.autodesk.fbx'
	; // eslint-disable-line semi-style

export type FileTypeResult = {
	/**
	One of the supported [file types](https://github.com/sindresorhus/file-type#supported-file-types).
	*/
	readonly ext: FileExtension;

	/**
	The detected [MIME type](https://en.wikipedia.org/wiki/Internet_media_type).
	*/
	readonly mime: MimeType;
};

export type ReadableStreamWithFileType = ReadableStream & {
	readonly fileType?: FileTypeResult;
};

/**
Detect the file type of a `Buffer`, `Uint8Array`, or `ArrayBuffer`.

The file type is detected by checking the [magic number](https://en.wikipedia.org/wiki/Magic_number_(programming)#Magic_numbers_in_files) of the buffer.

If file access is available, it is recommended to use `.fromFile()` instead.

@param buffer - An Uint8Array or Buffer representing file data. It works best if the buffer contains the entire file. It may work with a smaller portion as well.
@returns The detected file type, or `undefined` when there is no match.
*/
export function fileTypeFromBuffer(buffer: Uint8Array | ArrayBuffer): Promise<FileTypeResult | undefined>;

/**
Detect the file type of a Node.js [readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable).

The file type is detected by checking the [magic number](https://en.wikipedia.org/wiki/Magic_number_(programming)#Magic_numbers_in_files) of the buffer.

@param stream - A readable stream representing file data.
@returns The detected file type, or `undefined` when there is no match.
*/
export function fileTypeFromStream(stream: ReadableStream): Promise<FileTypeResult | undefined>;

/**
Detect the file type from an [`ITokenizer`](https://github.com/Borewit/strtok3#tokenizer) source.

This method is used internally, but can also be used for a special "tokenizer" reader.

A tokenizer propagates the internal read functions, allowing alternative transport mechanisms, to access files, to be implemented and used.

@param tokenizer - File source implementing the tokenizer interface.
@returns The detected file type, or `undefined` when there is no match.

An example is [`@tokenizer/http`](https://github.com/Borewit/tokenizer-http), which requests data using [HTTP-range-requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests). A difference with a conventional stream and the [*tokenizer*](https://github.com/Borewit/strtok3#tokenizer), is that it is able to *ignore* (seek, fast-forward) in the stream. For example, you may only need and read the first 6 bytes, and the last 128 bytes, which may be an advantage in case reading the entire file would take longer.

@example
```
import {makeTokenizer} from '@tokenizer/http';
import {fileTypeFromTokenizer} from 'file-type';

const audioTrackUrl = 'https://test-audio.netlify.com/Various%20Artists%20-%202009%20-%20netBloc%20Vol%2024_%20tiuqottigeloot%20%5BMP3-V2%5D/01%20-%20Diablo%20Swing%20Orchestra%20-%20Heroines.mp3';

const httpTokenizer = await makeTokenizer(audioTrackUrl);
const fileType = await fileTypeFromTokenizer(httpTokenizer);

console.log(fileType);
//=> {ext: 'mp3', mime: 'audio/mpeg'}
```
*/
export function fileTypeFromTokenizer(tokenizer: ITokenizer): Promise<FileTypeResult | undefined>;

/**
Supported file extensions.
*/
export const supportedExtensions: ReadonlySet<FileExtension>;

/**
Supported MIME types.
*/
export const supportedMimeTypes: ReadonlySet<MimeType>;

export type StreamOptions = {
	/**
	The default sample size in bytes.

	@default 4100
	*/
	readonly sampleSize?: number;
};

/**
Returns a `Promise` which resolves to the original readable stream argument, but with an added `fileType` property, which is an object like the one returned from `fileTypeFromFile()`.

This method can be handy to put in between a stream, but it comes with a price.
Internally `stream()` builds up a buffer of `sampleSize` bytes, used as a sample, to determine the file type.
The sample size impacts the file detection resolution.
A smaller sample size will result in lower probability of the best file type detection.

**Note:** This method is only available when using Node.js.
**Note:** Requires Node.js 14 or later.

@param readableStream - A [readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) containing a file to examine.
@returns A `Promise` which resolves to the original readable stream argument, but with an added `fileType` property, which is an object like the one returned from `fileTypeFromFile()`.

@example
```
import got from 'got';
import {fileTypeStream} from 'file-type';

const url = 'https://upload.wikimedia.org/wikipedia/en/a/a9/Example.jpg';

const stream1 = got.stream(url);
const stream2 = await fileTypeStream(stream1, {sampleSize: 1024});

if (stream2.fileType?.mime === 'image/jpeg') {
	// stream2 can be used to stream the JPEG image (from the very beginning of the stream)
}
```
*/
export function fileTypeStream(readableStream: ReadableStream, options?: StreamOptions): Promise<ReadableStreamWithFileType>;

/**
Detect the file type of a [`Blob`](https://nodejs.org/api/buffer.html#class-blob) or [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File).

@param blob - The [`Blob`](https://nodejs.org/api/buffer.html#class-blob) used for file detection.
@returns The detected file type, or `undefined` when there is no match.

@example
```
import {fileTypeFromBlob} from 'file-type';

const blob = new Blob(['<?xml version="1.0" encoding="ISO-8859-1" ?>'], {
	type: 'text/plain',
	endings: 'native'
});

console.log(await fileTypeFromBlob(blob));
//=> {ext: 'txt', mime: 'text/plain'}
```
*/
export declare function fileTypeFromBlob(blob: Blob): Promise<FileTypeResult | undefined>;

/**
Function that allows specifying custom detection mechanisms.

An iterable of detectors can be provided via the `fileTypeOptions` argument for the {@link FileTypeParser.constructor}.

The detectors are called before the default detections in the provided order.

Custom detectors can be used to add new `FileTypeResults` or to modify return behavior of existing `FileTypeResult` detections.

If the detector returns `undefined`, there are 2 possible scenarios:

1. The detector has not read from the tokenizer, it will be proceeded with the next available detector.
2. The detector has read from the tokenizer (`tokenizer.position` has been increased).
	In that case no further detectors will be executed and the final conclusion is that file-type returns undefined.
	Note that this an exceptional scenario, as the detector takes the opportunity from any other detector to determine the file type.

Example detector array which can be extended and provided via the fileTypeOptions argument:

```
import {FileTypeParser} from 'file-type';

const customDetectors = [
	async tokenizer => {
		const unicornHeader = [85, 78, 73, 67, 79, 82, 78]; // 'UNICORN' as decimal string

		const buffer = Buffer.alloc(7);
		await tokenizer.peekBuffer(buffer, {length: unicornHeader.length, mayBeLess: true});
		if (unicornHeader.every((value, index) => value === buffer[index])) {
			return {ext: 'unicorn', mime: 'application/unicorn'};
		}

		return undefined;
	},
];

const buffer = Buffer.from('UNICORN');
const parser = new FileTypeParser({customDetectors});
const fileType = await parser.fromBuffer(buffer);
console.log(fileType);
```

@param tokenizer - The [tokenizer](https://github.com/Borewit/strtok3#tokenizer) used to read the file content from.
@param fileType - The file type detected by the standard detections or a previous custom detection, or `undefined`` if no matching file type could be found.
@returns The detected file type, or `undefined` when there is no match.
*/
export type Detector = (tokenizer: ITokenizer, fileType?: FileTypeResult) => Promise<FileTypeResult | undefined>;

export type FileTypeOptions = {
	customDetectors?: Iterable<Detector>;
};

export declare class TokenizerPositionError extends Error {
	constructor(message?: string);
}

export declare class FileTypeParser {
	detectors: Iterable<Detector>;

	constructor(options?: {customDetectors?: Iterable<Detector>});

	/**
	Works the same way as {@link fileTypeFromBuffer}, additionally taking into account custom detectors (if any were provided to the constructor).
	*/
	fromBuffer(buffer: Uint8Array | ArrayBuffer): Promise<FileTypeResult | undefined>;

	/**
	Works the same way as {@link fileTypeFromStream}, additionally taking into account custom detectors (if any were provided to the constructor).
	*/
	fromStream(stream: ReadableStream): Promise<FileTypeResult | undefined>;

	/**
	Works the same way as {@link fileTypeFromTokenizer}, additionally taking into account custom detectors (if any were provided to the constructor).
	*/
	fromTokenizer(tokenizer: ITokenizer): Promise<FileTypeResult | undefined>;

	/**
	Works the same way as {@link fileTypeFromBlob}, additionally taking into account custom detectors (if any were provided to the constructor).
	*/
	fromBlob(blob: Blob): Promise<FileTypeResult | undefined>;

	/**
	Works the same way as {@link fileTypeStream}, additionally taking into account custom detectors (if any were provided to the constructor).
	*/
	toDetectionStream(readableStream: ReadableStream, options?: StreamOptions): Promise<FileTypeResult | undefined>;
}
