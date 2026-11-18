import * as strtok3 from 'strtok3';
import initDebug from 'debug';
import { parseFromTokenizer, scanAppendingHeaders } from './core.js';
import { ParserFactory } from './ParserFactory.js';
import { RandomFileReader } from './common/RandomFileReader.js';
export { parseFromTokenizer, parseBuffer, selectCover, orderTags, ratingToStars } from './core.js';
const debug = initDebug('music-metadata:parser');
/**
 * Parse audio from Node Stream.Readable
 * @param stream - Stream to read the audio track from
 * @param fileInfo - File information object or MIME-type, e.g.: 'audio/mpeg'
 * @param options - Parsing options
 * @returns Metadata
 */
export async function parseStream(stream, fileInfo, options = {}) {
    const tokenizer = await strtok3.fromStream(stream, typeof fileInfo === 'string' ? { mimeType: fileInfo } : fileInfo);
    return parseFromTokenizer(tokenizer, options);
}
/**
 * Parse audio from Node file
 * @param filePath - Media file to read meta-data from
 * @param options - Parsing options
 * @returns Metadata
 */
export async function parseFile(filePath, options = {}) {
    debug(`parseFile: ${filePath}`);
    const fileTokenizer = await strtok3.fromFile(filePath);
    const fileReader = await RandomFileReader.init(filePath, fileTokenizer.fileInfo.size);
    try {
        await scanAppendingHeaders(fileReader, options);
    }
    finally {
        await fileReader.close();
    }
    try {
        const parserName = ParserFactory.getParserIdForExtension(filePath);
        if (!parserName)
            debug(' Parser could not be determined by file extension');
        return await ParserFactory.parse(fileTokenizer, parserName, options);
    }
    finally {
        await fileTokenizer.close();
    }
}
