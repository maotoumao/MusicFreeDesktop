import { RequestStateCode } from "@/common/constant";
import React, { memo } from "react";
import "./index.scss";
import BottomLoadingState from "@/renderer/components/BottomLoadingState";
import useSearch from "../../../hooks/useSearch";
import MusicSheetlikeItem from "@/renderer/components/MusicSheetlikeItem";
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
  console.log(data);

  return (
    <MusicSheetlikeList
      data={data}
      state={state}
      onLoadMore={() => {
        search(undefined, undefined, "album", pluginHash);
      }}
      onClick={(albumItem) => {
        navigate(`/main/album/${albumItem.platform}/${albumItem.id}`, {
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
    prev.pluginHash === curr.pluginHash
);
