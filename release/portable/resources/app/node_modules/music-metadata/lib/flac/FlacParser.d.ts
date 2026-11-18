import { ITokenizer } from 'strtok3/core';
import { AbstractID3Parser } from '../id3v2/AbstractID3Parser.js';
import { INativeMetadataCollector } from '../common/MetadataCollector.js';
import { IOptions } from '../type.js';
import { ITokenParser } from '../ParserFactory.js';
export declare class FlacParser extends AbstractID3Parser {
    private vorbisParser;
    private padding;
    /**
     * Initialize parser with output (metadata), input (tokenizer) & parsing options (options).
     * @param {INativeMetadataCollector} metadata Output
     * @param {ITokenizer} tokenizer Input
     * @param {IOptions} options Parsing options
     */
    init(metadata: INativeMetadataCollector, tokenizer: ITokenizer, options: IOptions): ITokenParser;
    postId3v2Parse(): Promise<void>;
    private parseDataBlock;
    /**
     * Parse STREAMINFO
     */
    private parseBlockStreamInfo;
    /**
     * Parse VORBIS_COMMENT
     * Ref: https://www.xiph.org/vorbis/doc/Vorbis_I_spec.html#x1-640004.2.3
     */
    private parseComment;
    private parsePicture;
}
