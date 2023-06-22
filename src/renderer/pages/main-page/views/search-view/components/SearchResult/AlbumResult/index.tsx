import { RequestStateCode } from "@/common/constant";
import React, { memo } from "react";
import "./index.scss";
import BottomLoadingState from "@/renderer/components/BottomLoadingState";
import useSearch from "../../../hooks/useSearch";
import MusicSheetlikeItem from "@/renderer/components/MusicSheetlikeItem";

interface IMediaResultProps {
  data: IAlbum.IAlbumItem[];
  state: RequestStateCode;
  pluginHash: string;
}

function AlbumResult(props: IMediaResultProps) {
  const { data, state, pluginHash } = props;

  const search = useSearch();

  return (
    <div className="search-result--album-result-container">
      <div className="result-body">
        {data.map((albumItem, index) => {
          return (
            <MusicSheetlikeItem
              mediaItem={albumItem}
              key={index}
            ></MusicSheetlikeItem>
          );
        })}
      </div>
      <BottomLoadingState
        state={state}
        onLoadMore={() => {
          search(undefined, undefined, "album", pluginHash);
        }}
      ></BottomLoadingState>
    </div>
  );
}

export default memo(
  AlbumResult,
  (prev, curr) =>
    prev.data === curr.data &&
    prev.state === curr.state &&
    prev.pluginHash === curr.pluginHash
);
