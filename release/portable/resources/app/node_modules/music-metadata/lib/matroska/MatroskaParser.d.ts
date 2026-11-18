import { ITokenizer } from 'strtok3/core';
import { INativeMetadataCollector } from '../common/MetadataCollector.js';
import { BasicParser } from '../common/BasicParser.js';
import { IOptions } from '../type.js';
import { ITokenParser } from '../ParserFactory.js';
/**
 * Extensible Binary Meta Language (EBML) parser
 * https://en.wikipedia.org/wiki/Extensible_Binary_Meta_Language
 * http://matroska.sourceforge.net/technical/specs/rfc/index.html
 *
 * WEBM VP8 AUDIO FILE
 */
export declare class MatroskaParser extends BasicParser {
    private padding;
    private parserMap;
    private ebmlMaxIDLength;
    private ebmlMaxSizeLength;
    constructor();
    /**
     * Initialize parser with output (metadata), input (tokenizer) & parsing options (options).
     * @param {INativeMetadataCollector} metadata Output
     * @param {ITokenizer} tokenizer Input
     * @param {IOptions} options Parsing options
     */
    init(metadata: INativeMetadataCollector, tokenizer: ITokenizer, options: IOptions): ITokenParser;
    parse(): Promise<void>;
    private parseContainer;
    private readVintData;
    private readElement;
    private isMaxValue;
    private readFloat;
    private readFlag;
    private readUint;
    private readString;
    private readBuffer;
    private addTag;
}
