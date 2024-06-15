import React from "react";
import { useParams } from "react-router-dom";
import usePluginSheetMusicList from "./hooks/usePluginSheetMusicList";
import MusicSheetlikeView from "@/renderer/components/MusicSheetlikeView";
import { isSameMedia } from "@/common/media-util";

import MusicSheet from "@/renderer/core/music-sheet";
import { useTranslation } from "react-i18next";
import SvgAsset from "@/renderer/components/SvgAsset";

export default function RemoteSheet() {
  const { platform, id } = useParams() ?? {};

  const [state, sheetItem, musicList, getSheetDetail] = usePluginSheetMusicList(
    platform,
    id,
    history.state?.usr?.sheetItem
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
  const starredMusicSheets = MusicSheet.frontend.useAllStarredSheets();
  const { t } = useTranslation();

  const isStarred = starredMusicSheets.find((item) =>
    isSameMedia(sheetItem, item)
  );

  return (
    <>
      <div
        role="button"
        className="option-button"
        data-type="normalButton"
        onClick={() => {
          isStarred
            ? MusicSheet.frontend.unstarMusicSheet(sheetItem)
            : MusicSheet.frontend.starMusicSheet(sheetItem);
        }}
      >
        <SvgAsset
          iconName={isStarred ? "heart" : "heart-outline"}
          color={isStarred ? "red" : undefined}
        ></SvgAsset>
        <span>{t("music_sheet_like_view.star")}</span>
      </div>
    </>
  );
}
