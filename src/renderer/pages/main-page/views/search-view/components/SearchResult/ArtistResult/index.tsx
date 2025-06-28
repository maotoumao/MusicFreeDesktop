import { RequestStateCode } from "@/common/constant";
import BottomLoadingState from "@/renderer/components/BottomLoadingState";

import useSearch from "../../../hooks/useSearch";
import ArtistItem from "@/renderer/components/ArtistItem";
import "./index.scss";
import { useNavigate } from "react-router-dom";

interface IMediaResultProps {
    data: IArtist.IArtistItem[];
    state: RequestStateCode;
    pluginHash: string;
}

export default function ArtistResult(props: IMediaResultProps) {
    const { data, state, pluginHash } = props;

    const search = useSearch();
    const navigate = useNavigate();

    return (
        <div className="search-result--artist-result-container">
            <div className="result-body">
                {data.map((artistItem, index) => {
                    return <ArtistItem artistItem={artistItem} key={index} onClick={() => {
                        navigate(
                            `/main/artist/${encodeURIComponent(artistItem.platform)}/${encodeURIComponent(artistItem.id)}`,
                            {
                                state: {
                                    artistItem,
                                },
                            },
                        );
                    }}></ArtistItem>;
                })}
            </div>
            <BottomLoadingState
                state={state}
                onLoadMore={() => {
                    search(undefined, undefined, "artist", pluginHash);
                }}
            ></BottomLoadingState>
        </div>
    );
}
