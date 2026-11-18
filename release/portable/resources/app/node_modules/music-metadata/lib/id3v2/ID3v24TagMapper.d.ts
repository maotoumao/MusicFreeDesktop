import { CaseInsensitiveTagMap } from '../common/CaseInsensitiveTagMap.js';
import { INativeMetadataCollector } from '../common/MetadataCollector.js';
import { IRating, ITag } from '../type.js';
export declare class ID3v24TagMapper extends CaseInsensitiveTagMap {
    static toRating(popm: any): IRating;
    constructor();
    /**
     * Handle post mapping exceptions / correction
     * @param tag to post map
     * @param warnings Wil be used to register (collect) warnings
     * @return Common value e.g. "Buena Vista Social Club"
     */
    protected postMap(tag: ITag, warnings: INativeMetadataCollector): void;
}
