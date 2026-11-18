/// <reference types="node" resolution-mode="require"/>
import { ITokenizer } from 'strtok3/core';
import { IPageHeader } from '../Ogg.js';
import { VorbisParser } from '../vorbis/VorbisParser.js';
import { IOptions } from '../../type.js';
import { INativeMetadataCollector } from '../../common/MetadataCollector.js';
/**
 * Speex, RFC 5574
 * Ref:
 * - https://www.speex.org/docs/manual/speex-manual/
 * - https://tools.ietf.org/html/rfc5574
 */
export declare class SpeexParser extends VorbisParser {
    private tokenizer;
    constructor(metadata: INativeMetadataCollector, options: IOptions, tokenizer: ITokenizer);
    /**
     * Parse first Speex Ogg page
     * @param {IPageHeader} header
     * @param {Buffer} pageData
     */
    protected parseFirstPage(header: IPageHeader, pageData: Buffer): void;
}
