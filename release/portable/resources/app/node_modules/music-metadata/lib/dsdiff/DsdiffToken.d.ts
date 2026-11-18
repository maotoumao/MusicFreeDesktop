import { IGetToken } from 'strtok3/core';
import { IChunkHeader64 } from '../iff/index.js';
export { IChunkHeader64 } from '../iff/index.js';
/**
 * DSDIFF chunk header
 * The data-size encoding is deviating from EA-IFF 85
 * Ref: http://www.sonicstudio.com/pdf/dsd/DSDIFF_1.5_Spec.pdf
 */
export declare const ChunkHeader64: IGetToken<IChunkHeader64>;
