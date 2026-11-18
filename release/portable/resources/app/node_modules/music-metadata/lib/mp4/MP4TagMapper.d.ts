import { CaseInsensitiveTagMap } from '../common/CaseInsensitiveTagMap.js';
import { ITag } from "../type.js";
import { INativeMetadataCollector } from "../common/MetadataCollector.js";
export declare const tagType = "iTunes";
export declare class MP4TagMapper extends CaseInsensitiveTagMap {
    constructor();
    protected postMap(tag: ITag, warnings: INativeMetadataCollector): void;
}
