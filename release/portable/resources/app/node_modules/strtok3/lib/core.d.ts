/// <reference types="node" resolution-mode="require"/>
import { ReadStreamTokenizer } from './ReadStreamTokenizer.js';
import { Readable } from 'node:stream';
import { BufferTokenizer } from './BufferTokenizer.js';
import { IFileInfo } from './types.js';
export { EndOfStreamError } from 'peek-readable';
export { ITokenizer, IFileInfo } from './types.js';
export { IToken, IGetToken } from '@tokenizer/token';
/**
 * Construct ReadStreamTokenizer from given Stream.
 * Will set fileSize, if provided given Stream has set the .path property/
 * @param stream - Read from Node.js Stream.Readable
 * @param fileInfo - Pass the file information, like size and MIME-type of the corresponding stream.
 * @returns ReadStreamTokenizer
 */
export declare function fromStream(stream: Readable, fileInfo?: IFileInfo): ReadStreamTokenizer;
/**
 * Construct ReadStreamTokenizer from given Buffer.
 * @param uint8Array - Uint8Array to tokenize
 * @param fileInfo - Pass additional file information to the tokenizer
 * @returns BufferTokenizer
 */
export declare function fromBuffer(uint8Array: Uint8Array, fileInfo?: IFileInfo): BufferTokenizer;
