import {ReadableWebToNodeStream} from 'readable-web-to-node-stream';
import {fileTypeFromStream as coreFileTypeFromStream} from './core.js';

export async function fileTypeFromStream(stream) {
	const readableWebToNodeStream = new ReadableWebToNodeStream(stream);
	const fileType = await coreFileTypeFromStream(readableWebToNodeStream);
	await readableWebToNodeStream.close();
	return fileType;
}

export {
	fileTypeFromTokenizer,
	fileTypeFromBuffer,
	fileTypeStream,
} from './core.js';
