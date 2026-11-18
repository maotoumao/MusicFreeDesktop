/// <reference types="node" resolution-mode="require"/>
import { IVorbisPicture } from './Vorbis.js';
import { IPageConsumer, IPageHeader } from '../Ogg.js';
import { IOptions } from '../../type.js';
import { INativeMetadataCollector } from '../../common/MetadataCollector.js';
/**
 * Vorbis 1 Parser.
 * Used by OggParser
 */
export declare class VorbisParser implements IPageConsumer {
    protected metadata: INativeMetadataCollector;
    protected options: IOptions;
    private pageSegments;
    constructor(metadata: INativeMetadataCollector, options: IOptions);
    /**
     * Vorbis 1 parser
     * @param header Ogg Page Header
     * @param pageData Page data
     */
    parsePage(header: IPageHeader, pageData: Buffer): void;
    flush(): void;
    parseUserComment(pageData: Buffer, offset: number): number;
    addTag(id: string, value: string | IVorbisPicture): void;
    calculateDuration(header: IPageHeader): void;
    /**
     * Parse first Ogg/Vorbis page
     * @param header
     * @param pageData
     */
    protected parseFirstPage(header: IPageHeader, pageData: Buffer): void;
    protected parseFullPage(pageData: Buffer): void;
    /**
     * Ref: https://xiph.org/vorbis/doc/Vorbis_I_spec.html#x1-840005.2
     */
    protected parseUserCommentList(pageData: Buffer, offset: number): void;
}
