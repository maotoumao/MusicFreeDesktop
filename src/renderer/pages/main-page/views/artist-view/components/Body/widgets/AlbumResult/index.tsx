import { useEffect } from "react";
import useQueryArtist from "../../../../hooks/useQueryArtist";
import { queryResultStore } from "../../../../store";
import Condition from "@/renderer/components/Condition";
import { RequestStateCode } from "@/common/constant";
import Loading from "@/renderer/components/Loading";
import MusicSheetlikeList from "@/renderer/components/MusicSheetlikeList";
import "./index.scss";
import { useNavigate } from "react-router-dom";

interface IBodyProps {
    artistItem: IArtist.IArtistItem;
}

export default function AlbumResult(props: IBodyProps) {
    const { artistItem } = props;
    const queryArtist = useQueryArtist();
    const queryResult = queryResultStore.useValue().album;

    const navigate = useNavigate();

    useEffect(() => {
        queryArtist(artistItem, 1, "album");
    }, []);

    return (
        <div className="artist-view--album-result-container">
            <Condition
                condition={
                    queryResult.state &&
          queryResult.state !== RequestStateCode.PENDING_FIRST_PAGE
                }
                falsy={<Loading></Loading>}
            >
                <MusicSheetlikeList
                    data={queryResult.data ?? []}
                    state={queryResult.state}
                    onClick={(mediaItem) => {
                        navigate(`/main/album/${encodeURIComponent(mediaItem.platform)}/${encodeURIComponent(mediaItem.id)}`, {
                            state: {
                                albumItem: mediaItem,
                            },
                        });
                    }}
                    onLoadMore={() => {
                        queryArtist(artistItem, undefined, "album");
                    }}
                ></MusicSheetlikeList>
            </Condition>
        </div>
    );
}
