import { RequestStateCode } from "@/common/constant";
import React, { memo } from "react";
import "./index.scss";
import useSearch from "../../../hooks/useSearch";
import { useNavigate } from "react-router-dom";
import MusicSheetlikeList from "@/renderer/components/MusicSheetlikeList";

interface IMediaResultProps {
    data: IAlbum.IAlbumItem[];
    state: RequestStateCode;
    pluginHash: string;
}

function AlbumResult(props: IMediaResultProps) {
    const { data, state, pluginHash } = props;

    const search = useSearch();
    const navigate = useNavigate();

    return (
        <MusicSheetlikeList
            data={data}
            state={state}
            onLoadMore={() => {
                search(undefined, undefined, "album", pluginHash);
            }}
            onClick={(albumItem) => {
                navigate(`/main/album/${encodeURIComponent(albumItem.platform)}/${encodeURIComponent(albumItem.id)}`, {
                    state: {
                        albumItem,
                    },
                });
            }}
        ></MusicSheetlikeList>
    );
}

export default memo(
    AlbumResult,
    (prev, curr) =>
        prev.data === curr.data &&
    prev.state === curr.state &&
    prev.pluginHash === curr.pluginHash,
);
