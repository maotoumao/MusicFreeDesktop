/// <reference types="node" resolution-mode="require"/>
import { ITokenizer } from 'strtok3/core';
import { IPageHeader } from '../Ogg.js';
import { VorbisParser } from '../vorbis/VorbisParser.js';
import { IOptions } from '../../type.js';
import { INativeMetadataCollector } from '../../common/MetadataCollector.js';
/**
 * Opus parser
 * Internet Engineering Task Force (IETF) - RFC 6716
 * Used by OggParser
 */
export declare class OpusParser extends VorbisParser {
    private tokenizer;
    private idHeader;
    private lastPos;
    constructor(metadata: INativeMetadataCollector, options: IOptions, tokenizer: ITokenizer);
    /**
     * Parse first Opus Ogg page
     * @param {IPageHeader} header
     * @param {Buffer} pageData
     */
    protected parseFirstPage(header: IPageHeader, pageData: Buffer): void;
    protected parseFullPage(pageData: Buffer): void;
    calculateDuration(header: IPageHeader): void;
}
