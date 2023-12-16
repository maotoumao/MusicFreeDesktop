import localMusicListStore from "@/renderer/core/local-music/store";
import { Tab } from "@headlessui/react";
import { useTranslation } from "react-i18next";

import "./index.scss";
import MusicList from "@/renderer/components/MusicList";
import { showModal } from "@/renderer/components/Modal";
import SvgAsset from "@/renderer/components/SvgAsset";
import { useUserPerference } from "@/renderer/utils/user-perference";
import { useState } from "react";
import SwitchCase from "@/renderer/components/SwitchCase";
import ListView from "./views/list";
import ArtistView from "./views/artist";
import AlbumView from "./views/album";
import FolderView from "./views/folder";

enum DisplayView {
  LIST,
  ARTIST,
  ALBUM,
  FOLDER,
}

export default function LocalMusicView() {
  const { t } = useTranslation();
  const [displayView, setDisplayView] = useState(DisplayView.LIST);

  return (
    <div className="local-music-view--container" data-full-page={displayView !== DisplayView.LIST}>
      <div className="header">本地音乐</div>
      <div className="operations">
        <div
          data-type="normalButton"
          role="button"
          onClick={() => {
            showModal("WatchLocalDir");
          }}
        >
          自动扫描
        </div>
        <div className="operations-layout">
          <div>搜索</div>
          <div
            className="list-view-action"
            data-selected={displayView === DisplayView.LIST}
            title="列表视图"
            onClick={() => {
              setDisplayView(DisplayView.LIST);
            }}
          >
            <SvgAsset iconName="musical-note"></SvgAsset>
          </div>
          <div
            className="list-view-action"
            data-selected={displayView === DisplayView.ARTIST}
            title="作者视图"
            onClick={() => {
              setDisplayView(DisplayView.ARTIST);
            }}
          >
            <SvgAsset iconName="user"></SvgAsset>
          </div>
          <div
            className="list-view-action"
            data-selected={displayView === DisplayView.ALBUM}
            title="专辑视图"
            onClick={() => {
              setDisplayView(DisplayView.ALBUM);
            }}
          >
            <SvgAsset iconName="cd"></SvgAsset>
          </div>
          <div
            className="list-view-action"
            data-selected={displayView === DisplayView.FOLDER}
            title="文件夹视图"
            onClick={() => {
              setDisplayView(DisplayView.FOLDER);
            }}
          >
            <SvgAsset iconName="folder-open"></SvgAsset>
          </div>
        </div>
      </div>
      <SwitchCase.Switch switch={displayView}>
        <SwitchCase.Case case={DisplayView.LIST}>
          <ListView></ListView>
        </SwitchCase.Case>
        <SwitchCase.Case case={DisplayView.ARTIST}>
          <ArtistView></ArtistView>
        </SwitchCase.Case>
        <SwitchCase.Case case={DisplayView.ALBUM}>
          <AlbumView></AlbumView>
        </SwitchCase.Case>
        <SwitchCase.Case case={DisplayView.FOLDER}>
          <FolderView></FolderView>
        </SwitchCase.Case>
      </SwitchCase.Switch>
    </div>
  );
}
