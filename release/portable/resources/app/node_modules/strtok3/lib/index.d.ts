/// <reference types="node" resolution-mode="require"/>
import { Readable } from 'node:stream';
import { ReadStreamTokenizer } from './ReadStreamTokenizer.js';
import * as core from './core.js';
export { fromFile } from './FileTokenizer.js';
export { ITokenizer, EndOfStreamError, fromBuffer, IFileInfo } from './core.js';
export { IToken, IGetToken } from '@tokenizer/token';
/**
 * Construct ReadStreamTokenizer from given Stream.
 * Will set fileSize, if provided given Stream has set the .path property.
 * @param stream - Node.js Stream.Readable
 * @param fileInfo - Pass additional file information to the tokenizer
 * @returns Tokenizer
 */
export declare function fromStream(stream: Readable, fileInfo?: core.IFileInfo): Promise<ReadStreamTokenizer>;
