import { CommonTagMapper } from '../../common/GenericTagMapper.js';
import { IRating, ITag } from '../../type.js';
export declare class VorbisTagMapper extends CommonTagMapper {
    static toRating(email: string, rating: string, maxScore: number): IRating;
    constructor();
    protected postMap(tag: ITag): void;
}
