/// <reference types="node" resolution-mode="require"/>
import * as Stream from 'stream';
import * as strtok3 from 'strtok3';
import { IAudioMetadata, IOptions } from './type.js';
export { IAudioMetadata, IOptions, ITag, INativeTagDict, ICommonTagsResult, IFormat, IPicture, IRatio, IChapter } from './type.js';
export { parseFromTokenizer, parseBuffer, selectCover, orderTags, ratingToStars, IFileInfo } from './core.js';
/**
 * Parse audio from Node Stream.Readable
 * @param stream - Stream to read the audio track from
 * @param fileInfo - File information object or MIME-type, e.g.: 'audio/mpeg'
 * @param options - Parsing options
 * @returns Metadata
 */
export declare function parseStream(stream: Stream.Readable, fileInfo?: strtok3.IFileInfo | string, options?: IOptions): Promise<IAudioMetadata>;
/**
 * Parse audio from Node file
 * @param filePath - Media file to read meta-data from
 * @param options - Parsing options
 * @returns Metadata
 */
export declare function parseFile(filePath: string, options?: IOptions): Promise<IAudioMetadata>;
