import { ITokenizer } from 'strtok3/core';
import { ITokenParser } from '../ParserFactory.js';
import { IOptions, IPrivateOptions } from '../type.js';
import { INativeMetadataCollector } from './MetadataCollector.js';
export declare abstract class BasicParser implements ITokenParser {
    protected metadata: INativeMetadataCollector;
    protected tokenizer: ITokenizer;
    protected options: IPrivateOptions;
    /**
     * Initialize parser with output (metadata), input (tokenizer) & parsing options (options).
     * @param {INativeMetadataCollector} metadata Output
     * @param {ITokenizer} tokenizer Input
     * @param {IOptions} options Parsing options
     */
    init(metadata: INativeMetadataCollector, tokenizer: ITokenizer, options: IOptions): ITokenParser;
    abstract parse(): any;
}
