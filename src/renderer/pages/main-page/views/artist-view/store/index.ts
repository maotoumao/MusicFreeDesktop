import { RequestStateCode } from "@/common/constant";
import Store from "@/common/store";


export interface IQueryResult<
    T extends IArtist.ArtistMediaType = IArtist.ArtistMediaType,
> {
    state?: RequestStateCode;
    page?: number;
    data?: IMedia.SupportMediaItem[T][];
}

type IQueryResults<
    K extends IArtist.ArtistMediaType = IArtist.ArtistMediaType,
> = {
    [T in K]: IQueryResult<T>;
};

export const initQueryResult: IQueryResults = {
    music: {},
    album: {},
};

export const queryResultStore = new Store(initQueryResult);
