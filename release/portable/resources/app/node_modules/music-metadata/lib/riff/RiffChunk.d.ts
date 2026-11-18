import { IGetToken } from 'strtok3/core';
import { IChunkHeader } from '../iff/index.js';
export { IChunkHeader } from '../iff/index.js';
/**
 * Common RIFF chunk header
 */
export declare const Header: IGetToken<IChunkHeader>;
/**
 * Token to parse RIFF-INFO tag value
 */
export declare class ListInfoTagValue implements IGetToken<string> {
    private tagHeader;
    len: number;
    constructor(tagHeader: IChunkHeader);
    get(buf: any, off: any): string;
}
