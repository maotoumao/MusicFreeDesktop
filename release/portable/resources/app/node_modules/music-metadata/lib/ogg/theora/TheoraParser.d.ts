/// <reference types="node" resolution-mode="require"/>
import { ITokenizer } from 'strtok3/core';
import * as Ogg from '../Ogg.js';
import { IOptions } from '../../type.js';
import { INativeMetadataCollector } from '../../common/MetadataCollector.js';
/**
 * Ref:
 * - https://theora.org/doc/Theora.pdf
 */
export declare class TheoraParser implements Ogg.IPageConsumer {
    private metadata;
    private tokenizer;
    constructor(metadata: INativeMetadataCollector, options: IOptions, tokenizer: ITokenizer);
    /**
     * Vorbis 1 parser
     * @param header Ogg Page Header
     * @param pageData Page data
     */
    parsePage(header: Ogg.IPageHeader, pageData: Buffer): void;
    flush(): void;
    calculateDuration(header: Ogg.IPageHeader): void;
    /**
     * Parse first Theora Ogg page. the initial identification header packet
     * @param {IPageHeader} header
     * @param {Buffer} pageData
     */
    protected parseFirstPage(header: Ogg.IPageHeader, pageData: Buffer): void;
}
