# file-type

> Detect the file type of a Buffer/Uint8Array/ArrayBuffer

The file type is detected by checking the [magic number](https://en.wikipedia.org/wiki/Magic_number_(programming)#Magic_numbers_in_files) of the buffer.

This package is for detecting binary-based file formats, not text-based formats like `.txt`, `.csv`, `.svg`, etc.

We accept contributions for commonly used modern file formats, not historical or obscure ones. Open an issue first for discussion.

## Install

```sh
npm install file-type
```

**This package is a ESM package. Your project needs to be ESM too. [Read more](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c).**

If you use it with Webpack, you need the latest Webpack version and ensure you configure it correctly for ESM.

## Usage

#### Node.js

Determine file type from a file:

```js
import {fileTypeFromFile} from 'file-type';

console.log(await fileTypeFromFile('Unicorn.png'));
//=> {ext: 'png', mime: 'image/png'}
```

Determine file type from a Buffer, which may be a portion of the beginning of a file:

```js
import {fileTypeFromBuffer} from 'file-type';
import {readChunk} from 'read-chunk';

const buffer = await readChunk('Unicorn.png', {length: 4100});

console.log(await fileTypeFromBuffer(buffer));
//=> {ext: 'png', mime: 'image/png'}
```

Determine file type from a stream:

```js
import fs from 'node:fs';
import {fileTypeFromStream} from 'file-type';

const stream = fs.createReadStream('Unicorn.mp4');

console.log(await fileTypeFromStream(stream));
//=> {ext: 'mp4', mime: 'video/mp4'}
```

The stream method can also be used to read from a remote location:

```js
import got from 'got';
import {fileTypeFromStream} from 'file-type';

const url = 'https://upload.wikimedia.org/wikipedia/en/a/a9/Example.jpg';

const stream = got.stream(url);

console.log(await fileTypeFromStream(stream));
//=> {ext: 'jpg', mime: 'image/jpeg'}
```

Another stream example:

```js
import stream from 'node:stream';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileTypeStream} from 'file-type';

const read = fs.createReadStream('encrypted.enc');
const decipher = crypto.createDecipheriv(alg, key, iv);

const streamWithFileType = await fileTypeStream(stream.pipeline(read, decipher));

console.log(streamWithFileType.fileType);
//=> {ext: 'mov', mime: 'video/quicktime'}

const write = fs.createWriteStream(`decrypted.${streamWithFileType.fileType.ext}`);
streamWithFileType.pipe(write);
```

#### Browser

```js
import {fileTypeFromStream} from 'file-type';

const url = 'https://upload.wikimedia.org/wikipedia/en/a/a9/Example.jpg';

const response = await fetch(url);
const fileType = await fileTypeFromStream(response.body);

console.log(fileType);
//=> {ext: 'jpg', mime: 'image/jpeg'}
```

## API

### fileTypeFromBuffer(buffer)

Detect the file type of a `Buffer`, `Uint8Array`, or `ArrayBuffer`.

The file type is detected by checking the [magic number](https://en.wikipedia.org/wiki/Magic_number_(programming)#Magic_numbers_in_files) of the buffer.

If file access is available, it is recommended to use `fileTypeFromFile()` instead.

Returns a `Promise` for an object with the detected file type:

- `ext` - One of the [supported file types](#supported-file-types)
- `mime` - The [MIME type](https://en.wikipedia.org/wiki/Internet_media_type)

Or `undefined` when there is no match.

#### buffer

Type: `Buffer | Uint8Array | ArrayBuffer`

A buffer representing file data. It works best if the buffer contains the entire file. It may work with a smaller portion as well.

### fileTypeFromFile(filePath)

Detect the file type of a file path.

The file type is detected by checking the [magic number](https://en.wikipedia.org/wiki/Magic_number_(programming)#Magic_numbers_in_files) of the buffer.

Returns a `Promise` for an object with the detected file type:

- `ext` - One of the [supported file types](#supported-file-types)
- `mime` - The [MIME type](https://en.wikipedia.org/wiki/Internet_media_type)

Or `undefined` when there is no match.

#### filePath

Type: `string`

The file path to parse.

### fileTypeFromStream(stream)

Detect the file type of a Node.js [readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable).

The file type is detected by checking the [magic number](https://en.wikipedia.org/wiki/Magic_number_(programming)#Magic_numbers_in_files) of the buffer.

Returns a `Promise` for an object with the detected file type:

- `ext` - One of the [supported file types](#supported-file-types)
- `mime` - The [MIME type](https://en.wikipedia.org/wiki/Internet_media_type)

Or `undefined` when there is no match.

#### stream

Type: [`stream.Readable`](https://nodejs.org/api/stream.html#stream_class_stream_readable)

A readable stream representing file data.

### fileTypeFromBlob(blob)

Detect the file type of a [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob).

The file type is detected by checking the [magic number](https://en.wikipedia.org/wiki/Magic_number_(programming)#Magic_numbers_in_files) of the buffer.

Returns a `Promise` for an object with the detected file type:

- `ext` - One of the [supported file types](#supported-file-types)
- `mime` - The [MIME type](https://en.wikipedia.org/wiki/Internet_media_type)

Or `undefined` when there is no match.

```js
import {fileTypeFromBlob} from 'file-type';

const blob = new Blob(['<?xml version="1.0" encoding="ISO-8859-1" ?>'], {
	type: 'text/plain',
	endings: 'native'
});

console.log(await fileTypeFromBlob(blob));
//=> {ext: 'txt', mime: 'text/plain'}
```

#### blob

Type: [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob)

### fileTypeFromTokenizer(tokenizer)

Detect the file type from an `ITokenizer` source.

This method is used internally, but can also be used for a special "tokenizer" reader.

A tokenizer propagates the internal read functions, allowing alternative transport mechanisms, to access files, to be implemented and used.

Returns a `Promise` for an object with the detected file type:

- `ext` - One of the [supported file types](#supported-file-types)
- `mime` - The [MIME type](https://en.wikipedia.org/wiki/Internet_media_type)

Or `undefined` when there is no match.

An example is [`@tokenizer/http`](https://github.com/Borewit/tokenizer-http), which requests data using [HTTP-range-requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests). A difference with a conventional stream and the [*tokenizer*](https://github.com/Borewit/strtok3#tokenizer), is that it can *ignore* (seek, fast-forward) in the stream. For example, you may only need and read the first 6 bytes, and the last 128 bytes, which may be an advantage in case reading the entire file would take longer.

```js
import {makeTokenizer} from '@tokenizer/http';
import {fileTypeFromTokenizer} from 'file-type';

const audioTrackUrl = 'https://test-audio.netlify.com/Various%20Artists%20-%202009%20-%20netBloc%20Vol%2024_%20tiuqottigeloot%20%5BMP3-V2%5D/01%20-%20Diablo%20Swing%20Orchestra%20-%20Heroines.mp3';

const httpTokenizer = await makeTokenizer(audioTrackUrl);
const fileType = await fileTypeFromTokenizer(httpTokenizer);

console.log(fileType);
//=> {ext: 'mp3', mime: 'audio/mpeg'}
```

Or use [`@tokenizer/s3`](https://github.com/Borewit/tokenizer-s3) to determine the file type of a file stored on [Amazon S3](https://aws.amazon.com/s3):

```js
import S3 from 'aws-sdk/clients/s3';
import {makeTokenizer} from '@tokenizer/s3';
import {fileTypeFromTokenizer} from 'file-type';

// Initialize the S3 client
const s3 = new S3();

// Initialize the S3 tokenizer.
const s3Tokenizer = await makeTokenizer(s3, {
	Bucket: 'affectlab',
	Key: '1min_35sec.mp4'
});

// Figure out what kind of file it is.
const fileType = await fileTypeFromTokenizer(s3Tokenizer);
console.log(fileType);
```

Note that only the minimum amount of data required to determine the file type is read (okay, just a bit extra to prevent too many fragmented reads).

#### tokenizer

Type: [`ITokenizer`](https://github.com/Borewit/strtok3#tokenizer)

A file source implementing the [tokenizer interface](https://github.com/Borewit/strtok3#tokenizer).

### fileTypeStream(readableStream, options?)

Returns a `Promise` which resolves to the original readable stream argument, but with an added `fileType` property, which is an object like the one returned from `fileTypeFromFile()`.

This method can be handy to put in between a stream, but it comes with a price.
Internally `stream()` builds up a buffer of `sampleSize` bytes, used as a sample, to determine the file type.
The sample size impacts the file detection resolution.
A smaller sample size will result in lower probability of the best file type detection.

**Note:** This method is only available when using Node.js.
**Note:** Requires Node.js 14 or later.

#### readableStream

Type: [`stream.Readable`](https://nodejs.org/api/stream.html#stream_class_stream_readable)

#### options

Type: `object`

##### sampleSize

Type: `number`\
Default: `4100`

The sample size in bytes.

#### Example

```js
import got from 'got';
import {fileTypeStream} from 'file-type';

const url = 'https://upload.wikimedia.org/wikipedia/en/a/a9/Example.jpg';

const stream1 = got.stream(url);
const stream2 = await fileTypeStream(stream1, {sampleSize: 1024});

if (stream2.fileType?.mime === 'image/jpeg') {
	// stream2 can be used to stream the JPEG image (from the very beginning of the stream)
}
```

#### readableStream

Type: [`stream.Readable`](https://nodejs.org/api/stream.html#stream_class_stream_readable)

The input stream.

### supportedExtensions

Returns a `Set<string>` of supported file extensions.

### supportedMimeTypes

Returns a `Set<string>` of supported MIME types.

## Custom detectors

A custom detector is a function that allows specifying custom detection mechanisms.

An iterable of detectors can be provided via the `fileTypeOptions` argument for the `FileTypeParser` constructor.

The detectors are called before the default detections in the provided order.

Custom detectors can be used to add new `FileTypeResults` or to modify return behaviour of existing `FileTypeResult` detections.

If the detector returns `undefined`, there are 2 possible scenarios:

1. The detector has not read from the tokenizer, it will be proceeded with the next available detector.
2. The detector has read from the tokenizer (`tokenizer.position` has been increased).
	In that case no further detectors will be executed and the final conclusion is that file-type returns undefined.
	Note that this an exceptional scenario, as the detector takes the opportunity from any other detector to determine the file type.

Example detector array which can be extended and provided to each public method via the `fileTypeOptions` argument:

```js
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

## Supported file types

- [`3g2`](https://en.wikipedia.org/wiki/3GP_and_3G2#3G2) - Multimedia container format defined by the 3GPP2 for 3G CDMA2000 multimedia services
- [`3gp`](https://en.wikipedia.org/wiki/3GP_and_3G2#3GP) - Multimedia container format defined by the Third Generation Partnership Project (3GPP) for 3G UMTS multimedia services
- [`3mf`](https://en.wikipedia.org/wiki/3D_Manufacturing_Format) - 3D Manufacturing Format
- [`7z`](https://en.wikipedia.org/wiki/7z) - 7-Zip archive
- [`Z`](https://fileinfo.com/extension/z) - Unix Compressed File
- [`aac`](https://en.wikipedia.org/wiki/Advanced_Audio_Coding) - Advanced Audio Coding
- [`ac3`](https://www.atsc.org/standard/a522012-digital-audio-compression-ac-3-e-ac-3-standard-12172012/) - ATSC A/52 Audio File
- [`ace`](https://en.wikipedia.org/wiki/ACE_(compressed_file_format)) - ACE archive
- [`ai`](https://en.wikipedia.org/wiki/Adobe_Illustrator_Artwork) - Adobe Illustrator Artwork
- [`aif`](https://en.wikipedia.org/wiki/Audio_Interchange_File_Format) - Audio Interchange file
- [`alias`](https://en.wikipedia.org/wiki/Alias_%28Mac_OS%29) - macOS Alias file
- [`amr`](https://en.wikipedia.org/wiki/Adaptive_Multi-Rate_audio_codec) - Adaptive Multi-Rate audio codec
- [`ape`](https://en.wikipedia.org/wiki/Monkey%27s_Audio) - Monkey's Audio
- [`apng`](https://en.wikipedia.org/wiki/APNG) - Animated Portable Network Graphics
- [`ar`](https://en.wikipedia.org/wiki/Ar_(Unix)) - Archive file
- [`arj`](https://en.wikipedia.org/wiki/ARJ) - Archive file
- [`arrow`](https://arrow.apache.org) - Columnar format for tables of data
- [`arw`](https://en.wikipedia.org/wiki/Raw_image_format#ARW) - Sony Alpha Raw image file
- [`asar`](https://github.com/electron/asar#format) - Archive format primarily used to enclose Electron applications
- [`asf`](https://en.wikipedia.org/wiki/Advanced_Systems_Format) - Advanced Systems Format
- [`avi`](https://en.wikipedia.org/wiki/Audio_Video_Interleave) - Audio Video Interleave file
- [`avif`](https://en.wikipedia.org/wiki/AV1#AV1_Image_File_Format_(AVIF)) - AV1 Image File Format
- [`avro`](https://en.wikipedia.org/wiki/Apache_Avro#Avro_Object_Container_File) - Object container file developed by Apache Avro
- [`blend`](https://wiki.blender.org/index.php/Dev:Source/Architecture/File_Format) - Blender project
- [`bmp`](https://en.wikipedia.org/wiki/BMP_file_format) - Bitmap image file
- [`bpg`](https://bellard.org/bpg/) - Better Portable Graphics file
- [`bz2`](https://en.wikipedia.org/wiki/Bzip2) - Archive file
- [`cab`](https://en.wikipedia.org/wiki/Cabinet_(file_format)) - Cabinet file
- [`cfb`](https://en.wikipedia.org/wiki/Compound_File_Binary_Format) - Compound File Binary Format
- [`chm`](https://en.wikipedia.org/wiki/Microsoft_Compiled_HTML_Help) - Microsoft Compiled HTML Help
- [`class`](https://en.wikipedia.org/wiki/Java_class_file) - Java class file
- [`cpio`](https://en.wikipedia.org/wiki/Cpio) - Cpio archive
- [`cr2`](https://fileinfo.com/extension/cr2) - Canon Raw image file (v2)
- [`cr3`](https://fileinfo.com/extension/cr3) - Canon Raw image file (v3)
- [`crx`](https://developer.chrome.com/extensions/crx) - Google Chrome extension
- [`cur`](https://en.wikipedia.org/wiki/ICO_(file_format)) - Icon file
- [`dcm`](https://en.wikipedia.org/wiki/DICOM#Data_format) - DICOM Image File
- [`deb`](https://en.wikipedia.org/wiki/Deb_(file_format)) - Debian package
- [`dmg`](https://en.wikipedia.org/wiki/Apple_Disk_Image) - Apple Disk Image
- [`dng`](https://en.wikipedia.org/wiki/Digital_Negative) - Adobe Digital Negative image file
- [`docx`](https://en.wikipedia.org/wiki/Office_Open_XML) - Microsoft Word document
- [`dsf`](https://dsd-guide.com/sites/default/files/white-papers/DSFFileFormatSpec_E.pdf) - Sony DSD Stream File (DSF)
- [`dwg`](https://en.wikipedia.org/wiki/.dwg) - Autodesk CAD file
- [`elf`](https://en.wikipedia.org/wiki/Executable_and_Linkable_Format) - Unix Executable and Linkable Format
- [`eot`](https://en.wikipedia.org/wiki/Embedded_OpenType) - Embedded OpenType font
- [`eps`](https://en.wikipedia.org/wiki/Encapsulated_PostScript) - Encapsulated PostScript
- [`epub`](https://en.wikipedia.org/wiki/EPUB) - E-book file
- [`exe`](https://en.wikipedia.org/wiki/.exe) - Executable file
- [`f4a`](https://en.wikipedia.org/wiki/Flash_Video) - Audio-only ISO base media file format used by Adobe Flash Player
- [`f4b`](https://en.wikipedia.org/wiki/Flash_Video) - Audiobook and podcast ISO base media file format used by Adobe Flash Player
- [`f4p`](https://en.wikipedia.org/wiki/Flash_Video) - ISO base media file format protected by Adobe Access DRM used by Adobe Flash Player
- [`f4v`](https://en.wikipedia.org/wiki/Flash_Video) - ISO base media file format used by Adobe Flash Player
- [`fbx`](https://en.wikipedia.org/wiki/FBX) - Filmbox is a proprietary file format used to provide interoperability between digital content creation apps.
- [`flac`](https://en.wikipedia.org/wiki/FLAC) - Free Lossless Audio Codec
- [`flif`](https://en.wikipedia.org/wiki/Free_Lossless_Image_Format) - Free Lossless Image Format
- [`flv`](https://en.wikipedia.org/wiki/Flash_Video) - Flash video
- [`gif`](https://en.wikipedia.org/wiki/GIF) - Graphics Interchange Format
- [`glb`](https://github.com/KhronosGroup/glTF) - GL Transmission Format
- [`gz`](https://en.wikipedia.org/wiki/Gzip) - Archive file
- [`heic`](https://nokiatech.github.io/heif/technical.html) - High Efficiency Image File Format
- [`icc`](https://en.wikipedia.org/wiki/ICC_profile) - ICC Profile
- [`icns`](https://en.wikipedia.org/wiki/Apple_Icon_Image_format) - Apple Icon image
- [`ico`](https://en.wikipedia.org/wiki/ICO_(file_format)) - Windows icon file
- [`ics`](https://en.wikipedia.org/wiki/ICalendar#Data_format) - iCalendar
- [`indd`](https://en.wikipedia.org/wiki/Adobe_InDesign#File_format) - Adobe InDesign document
- [`it`](https://wiki.openmpt.org/Manual:_Module_formats#The_Impulse_Tracker_format_.28.it.29) - Audio module format: Impulse Tracker
- [`j2c`](https://en.wikipedia.org/wiki/JPEG_2000) - JPEG 2000
- [`jls`](https://en.wikipedia.org/wiki/Lossless_JPEG#JPEG-LS) - Lossless/near-lossless compression standard for continuous-tone images
- [`jp2`](https://en.wikipedia.org/wiki/JPEG_2000) - JPEG 2000
- [`jpg`](https://en.wikipedia.org/wiki/JPEG) - Joint Photographic Experts Group image
- [`jpm`](https://en.wikipedia.org/wiki/JPEG_2000) - JPEG 2000
- [`jpx`](https://en.wikipedia.org/wiki/JPEG_2000) - JPEG 2000
- [`jxl`](https://en.wikipedia.org/wiki/JPEG_XL) - JPEG XL image format
- [`jxr`](https://en.wikipedia.org/wiki/JPEG_XR) - Joint Photographic Experts Group extended range
- [`ktx`](https://www.khronos.org/opengles/sdk/tools/KTX/file_format_spec/) - OpenGL and OpenGL ES textures
- [`lnk`](https://en.wikipedia.org/wiki/Shortcut_%28computing%29#Microsoft_Windows) - Microsoft Windows file shortcut
- [`lz`](https://en.wikipedia.org/wiki/Lzip) - Archive file
- [`lzh`](https://en.wikipedia.org/wiki/LHA_(file_format)) - LZH archive
- [`m4a`](https://en.wikipedia.org/wiki/M4A) - Audio-only MPEG-4 files
- [`m4b`](https://en.wikipedia.org/wiki/M4B) - Audiobook and podcast MPEG-4 files, which also contain metadata including chapter markers, images, and hyperlinks
- [`m4p`](https://en.wikipedia.org/wiki/MPEG-4_Part_14#Filename_extensions) - MPEG-4 files with audio streams encrypted by FairPlay Digital Rights Management as were sold through the iTunes Store
- [`m4v`](https://en.wikipedia.org/wiki/M4V) - Video container format developed by Apple, which is very similar to the MP4 format
- [`macho`](https://en.wikipedia.org/wiki/Mach-O) - Mach-O binary format
- [`mid`](https://en.wikipedia.org/wiki/MIDI) - Musical Instrument Digital Interface file
- [`mie`](https://en.wikipedia.org/wiki/Sidecar_file) - Dedicated meta information format which supports storage of binary as well as textual meta information
- [`mj2`](https://en.wikipedia.org/wiki/Motion_JPEG_2000) - Motion JPEG 2000
- [`mkv`](https://en.wikipedia.org/wiki/Matroska) - Matroska video file
- [`mobi`](https://en.wikipedia.org/wiki/Mobipocket) - Mobipocket
- [`mov`](https://en.wikipedia.org/wiki/QuickTime_File_Format) - QuickTime video file
- [`mp1`](https://en.wikipedia.org/wiki/MPEG-1_Audio_Layer_I) - MPEG-1 Audio Layer I
- [`mp2`](https://en.wikipedia.org/wiki/MPEG-1_Audio_Layer_II) - MPEG-1 Audio Layer II
- [`mp3`](https://en.wikipedia.org/wiki/MP3) - Audio file
- [`mp4`](https://en.wikipedia.org/wiki/MPEG-4_Part_14#Filename_extensions) - MPEG-4 Part 14 video file
- [`mpc`](https://en.wikipedia.org/wiki/Musepack) - Musepack (SV7 & SV8)
- [`mpg`](https://en.wikipedia.org/wiki/MPEG-1) - MPEG-1 file
- [`mts`](https://en.wikipedia.org/wiki/.m2ts) - MPEG-2 Transport Stream, both raw and Blu-ray Disc Audio-Video (BDAV) versions
- [`mxf`](https://en.wikipedia.org/wiki/Material_Exchange_Format) - Material Exchange Format
- [`nef`](https://www.nikonusa.com/en/learn-and-explore/a/products-and-innovation/nikon-electronic-format-nef.html) - Nikon Electronic Format image file
- [`nes`](https://fileinfo.com/extension/nes) - Nintendo NES ROM
- [`odp`](https://en.wikipedia.org/wiki/OpenDocument) - OpenDocument for presentations
- [`ods`](https://en.wikipedia.org/wiki/OpenDocument) - OpenDocument for spreadsheets
- [`odt`](https://en.wikipedia.org/wiki/OpenDocument) - OpenDocument for word processing
- [`oga`](https://en.wikipedia.org/wiki/Ogg) - Audio file
- [`ogg`](https://en.wikipedia.org/wiki/Ogg) - Audio file
- [`ogm`](https://en.wikipedia.org/wiki/Ogg) - Audio file
- [`ogv`](https://en.wikipedia.org/wiki/Ogg) - Audio file
- [`ogx`](https://en.wikipedia.org/wiki/Ogg) - Audio file
- [`opus`](https://en.wikipedia.org/wiki/Opus_(audio_format)) - Audio file
- [`orf`](https://en.wikipedia.org/wiki/ORF_format) - Olympus Raw image file
- [`otf`](https://en.wikipedia.org/wiki/OpenType) - OpenType font
- [`parquet`](https://en.wikipedia.org/wiki/Apache_Parquet) - Apache Parquet
- [`pcap`](https://wiki.wireshark.org/Development/LibpcapFileFormat) - Libpcap File Format
- [`pdf`](https://en.wikipedia.org/wiki/Portable_Document_Format) - Portable Document Format
- [`pgp`](https://en.wikipedia.org/wiki/Pretty_Good_Privacy) - Pretty Good Privacy
- [`png`](https://en.wikipedia.org/wiki/Portable_Network_Graphics) - Portable Network Graphics
- [`pptx`](https://en.wikipedia.org/wiki/Office_Open_XML) - Microsoft Powerpoint document
- [`ps`](https://en.wikipedia.org/wiki/Postscript) - Postscript
- [`psd`](https://en.wikipedia.org/wiki/Adobe_Photoshop#File_format) - Adobe Photoshop document
- [`pst`](https://en.wikipedia.org/wiki/Personal_Storage_Table) - Personal Storage Table file
- [`qcp`](https://en.wikipedia.org/wiki/QCP) - Tagged and chunked data
- [`raf`](https://en.wikipedia.org/wiki/Raw_image_format) - Fujifilm RAW image file
- [`rar`](https://en.wikipedia.org/wiki/RAR_(file_format)) - Archive file
- [`rpm`](https://fileinfo.com/extension/rpm) - Red Hat Package Manager file
- [`rtf`](https://en.wikipedia.org/wiki/Rich_Text_Format) - Rich Text Format
- [`rw2`](https://en.wikipedia.org/wiki/Raw_image_format) - Panasonic RAW image file
- [`s3m`](https://wiki.openmpt.org/Manual:_Module_formats#The_ScreamTracker_3_format_.28.s3m.29) - Audio module format: ScreamTracker 3
- [`shp`](https://en.wikipedia.org/wiki/Shapefile) - Geospatial vector data format
- [`skp`](https://en.wikipedia.org/wiki/SketchUp) - SketchUp
- [`spx`](https://en.wikipedia.org/wiki/Ogg) - Audio file
- [`sqlite`](https://www.sqlite.org/fileformat2.html) - SQLite file
- [`stl`](https://en.wikipedia.org/wiki/STL_(file_format)) - Standard Tesselated Geometry File Format (ASCII only)
- [`swf`](https://en.wikipedia.org/wiki/SWF) - Adobe Flash Player file
- [`tar`](https://en.wikipedia.org/wiki/Tar_(computing)#File_format) - Tarball archive file
- [`tif`](https://en.wikipedia.org/wiki/Tagged_Image_File_Format) - Tagged Image file
- [`ttf`](https://en.wikipedia.org/wiki/TrueType) - TrueType font
- [`vcf`](https://en.wikipedia.org/wiki/VCard) - vCard
- [`voc`](https://wiki.multimedia.cx/index.php/Creative_Voice) - Creative Voice File
- [`wasm`](https://en.wikipedia.org/wiki/WebAssembly) - WebAssembly intermediate compiled format
- [`wav`](https://en.wikipedia.org/wiki/WAV) - Waveform Audio file
- [`webm`](https://en.wikipedia.org/wiki/WebM) - Web video file
- [`webp`](https://en.wikipedia.org/wiki/WebP) - Web Picture format
- [`woff`](https://en.wikipedia.org/wiki/Web_Open_Font_Format) - Web Open Font Format
- [`woff2`](https://en.wikipedia.org/wiki/Web_Open_Font_Format) - Web Open Font Format
- [`wv`](https://en.wikipedia.org/wiki/WavPack) - WavPack
- [`xcf`](https://en.wikipedia.org/wiki/XCF_(file_format)) - eXperimental Computing Facility
- [`xlsx`](https://en.wikipedia.org/wiki/Office_Open_XML) - Microsoft Excel document
- [`xm`](https://wiki.openmpt.org/Manual:_Module_formats#The_FastTracker_2_format_.28.xm.29) - Audio module format: FastTracker 2
- [`xml`](https://en.wikipedia.org/wiki/XML) - eXtensible Markup Language
- [`xpi`](https://en.wikipedia.org/wiki/XPInstall) - XPInstall file
- [`xz`](https://en.wikipedia.org/wiki/Xz) - Compressed file
- [`zip`](https://en.wikipedia.org/wiki/Zip_(file_format)) - Archive file
- [`zst`](https://en.wikipedia.org/wiki/Zstandard) - Archive file

*[Pull requests](.github/pull_request_template.md) are welcome for additional commonly used file types.*

The following file types will not be accepted:
- [MS-CFB: Microsoft Compound File Binary File Format based formats](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb/53989ce4-7b05-4f8d-829b-d08d6148375b), too old and difficult to parse:
	- `.doc` - Microsoft Word 97-2003 Document
	- `.xls` - Microsoft Excel 97-2003 Document
	- `.ppt` - Microsoft PowerPoint97-2003 Document
	- `.msi` - Microsoft Windows Installer
- `.csv` - [Reason.](https://github.com/sindresorhus/file-type/issues/264#issuecomment-568439196)
- `.svg` - Detecting it requires a full-blown parser. Check out [`is-svg`](https://github.com/sindresorhus/is-svg) for something that mostly works.

#### tokenizer

Type: [`ITokenizer`](https://github.com/Borewit/strtok3#tokenizer)

Usable as source of the examined file.

#### fileType

Type: `FileTypeResult`

An object having an `ext` (extension) and `mime` (mime type) property.

Detected by the standard detections or a previous custom detection. Undefined if no matching fileTypeResult could be found.

## Related

- [file-type-cli](https://github.com/sindresorhus/file-type-cli) - CLI for this module
- [image-dimensions](https://github.com/sindresorhus/image-dimensions) - Get the dimensions of an image

## Maintainers

- [Sindre Sorhus](https://github.com/sindresorhus)
- [Borewit](https://github.com/Borewit)
