import React from "react";
import { useParams } from "react-router-dom";
import usePluginSheetMusicList from "./hooks/usePluginSheetMusicList";
import MusicSheetlikeView from "@/renderer/components/MusicSheetlikeView";
import { starredSheetsStore } from "@/renderer/core/music-sheet";
import { isSameMedia } from "@/common/media-util";
import {
  starMusicSheet,
  unstarMusicSheet,
} from "@/renderer/core/music-sheet/internal/sheets-method";

export default function RemoteSheet() {
  const { platform, id } = useParams() ?? {};

  const [state, sheetItem, musicList, getSheetDetail] = usePluginSheetMusicList(
    {
      ...(history.state?.usr?.sheetItem ?? {}),
      platform,
      id,
    } as IMusic.IMusicSheetItem
  );
  return (
    <MusicSheetlikeView
      musicSheet={sheetItem}
      musicList={musicList}
      state={state}
      onLoadMore={() => {
        getSheetDetail();
      }}
      options={<RemoteSheetOptions sheetItem={sheetItem}></RemoteSheetOptions>}
    />
  );
}

interface IProps {
  sheetItem: IMusic.IMusicSheetItem;
}
function RemoteSheetOptions(props: IProps) {
  const { sheetItem } = props;
  const starredMusicSheets = starredSheetsStore.useValue();

  const isStarred = starredMusicSheets.find((item) =>
    isSameMedia(sheetItem, item)
  );

  return (
    <>
      <div
        role="button"
        data-type="normalButton"
        onClick={() => {
          isStarred ? unstarMusicSheet(sheetItem) : starMusicSheet(sheetItem);
        }}
      >
        {isStarred ? "取消收藏" : "收藏歌单"}
      </div>
    </>
  );
}
