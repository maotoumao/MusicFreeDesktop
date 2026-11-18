import type {FileTypeResult} from './core.js';

/**
Detect the file type of a [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream).

@example
```
import {fileTypeFromStream} from 'file-type';

const url = 'https://upload.wikimedia.org/wikipedia/en/a/a9/Example.jpg';

const response = await fetch(url);
const fileType = await fileTypeFromStream(response.body);

console.log(fileType);
//=> {ext: 'jpg', mime: 'image/jpeg'}
```
*/
export declare function fileTypeFromStream(stream: ReadableStream): Promise<FileTypeResult | undefined>;

export {
	fileTypeFromBuffer,
	fileTypeFromBlob,
	supportedExtensions,
	supportedMimeTypes,
	type FileTypeResult,
	type FileExtension,
	type MimeType,
} from './core.js';
