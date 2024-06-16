import localMusicListStore from "@/renderer/core/local-music/store";
import { Tab } from "@headlessui/react";
import { useTranslation } from "react-i18next";

import "./index.scss";
import MusicList from "@/renderer/components/MusicList";
import { showModal } from "@/renderer/components/Modal";
import SvgAsset from "@/renderer/components/SvgAsset";
import { useUserPreference } from "@/renderer/utils/user-perference";
import { useEffect, useState, useTransition } from "react";
import SwitchCase from "@/renderer/components/SwitchCase";
import ListView from "./views/list";
import ArtistView from "./views/artist";
import AlbumView from "./views/album";
import FolderView from "./views/folder";
import { getAppConfigPath } from "@/shared/app-config/renderer";

enum DisplayView {
  LIST,
  ARTIST,
  ALBUM,
  FOLDER,
}

export default function LocalMusicView() {
  const { t } = useTranslation();
  const [displayView, setDisplayView] = useState(DisplayView.LIST);

  const localMusicList = localMusicListStore.useValue();
  const [inputSearch, setInputSearch] = useState("");
  const [filterMusicList, setFilterMusicList] = useState<
    IMusic.IMusicItem[] | null
  >(null);

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (inputSearch.trim() === "") {
      setFilterMusicList(null);
    } else {
      startTransition(() => {
        const caseSensitive = getAppConfigPath(
          "playMusic.caseSensitiveInSearch"
        );
        if (caseSensitive) {
          setFilterMusicList(
            localMusicListStore
              .getValue()
              .filter(
                (item) =>
                  item.title?.includes(inputSearch) ||
                  item.artist?.includes(inputSearch) ||
                  item.album?.includes(inputSearch)
              )
          );
        } else {
          const searchText = inputSearch.toLocaleLowerCase();
          setFilterMusicList(
            localMusicListStore
              .getValue()
              .filter(
                (item) =>
                  item.title?.toLocaleLowerCase()?.includes(searchText) ||
                  item.artist?.toLocaleLowerCase()?.includes(searchText) ||
                  item.album?.toLocaleLowerCase()?.includes(searchText)
              )
          );
        }
      });
    }
  }, [inputSearch]);

  const finalMusicList = filterMusicList ?? localMusicList;

  return (
    <div
      id="page-container"
      className="page-container local-music-view--container"
      data-full-page={displayView !== DisplayView.LIST}
    >
      <div className="header">{t("local_music_page.local_music")}</div>
      <div className="operations">
        <div
          data-type="normalButton"
          role="button"
          onClick={() => {
            showModal("WatchLocalDir");
          }}
        >
          {t("local_music_page.auto_scan")}
        </div>
        <div className="operations-layout">
          <input
            className="search-local-music"
            spellCheck={false}
            onChange={(evt) => {
              setInputSearch(evt.target.value);
            }}
            placeholder={t("local_music_page.search_local_music")}
          ></input>
          <div
            className="list-view-action"
            data-selected={displayView === DisplayView.LIST}
            title={t("local_music_page.list_view")}
            onClick={() => {
              setDisplayView(DisplayView.LIST);
            }}
          >
            <SvgAsset iconName="musical-note"></SvgAsset>
          </div>
          <div
            className="list-view-action"
            data-selected={displayView === DisplayView.ARTIST}
            title={t("local_music_page.artist_view")}
            onClick={() => {
              setDisplayView(DisplayView.ARTIST);
            }}
          >
            <SvgAsset iconName="user"></SvgAsset>
          </div>
          <div
            className="list-view-action"
            data-selected={displayView === DisplayView.ALBUM}
            title={t("local_music_page.album_view")}
            onClick={() => {
              setDisplayView(DisplayView.ALBUM);
            }}
          >
            <SvgAsset iconName="cd"></SvgAsset>
          </div>
          <div
            className="list-view-action"
            data-selected={displayView === DisplayView.FOLDER}
            title={t("local_music_page.folder_view")}
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
          <ListView localMusicList={finalMusicList}></ListView>
        </SwitchCase.Case>
        <SwitchCase.Case case={DisplayView.ARTIST}>
          <ArtistView localMusicList={finalMusicList}></ArtistView>
        </SwitchCase.Case>
        <SwitchCase.Case case={DisplayView.ALBUM}>
          <AlbumView localMusicList={finalMusicList}></AlbumView>
        </SwitchCase.Case>
        <SwitchCase.Case case={DisplayView.FOLDER}>
          <FolderView localMusicList={finalMusicList}></FolderView>
        </SwitchCase.Case>
      </SwitchCase.Switch>
    </div>
  );
}
