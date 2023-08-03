import localMusicListStore from "@/renderer/core/local-music/store";
import { Tab } from "@headlessui/react";
import { useTranslation } from "react-i18next";

import './index.scss';
import MusicList from "@/renderer/components/MusicList";
import { showModal } from "@/renderer/components/Modal";

const displayBy = ["default", "artist", "folder"];

export default function LocalMusicView() {
  const localMusicList = localMusicListStore.useValue();
  const { t } = useTranslation();

  return (
    <div className="local-music-view--container">
      <div className="header">
        本地音乐
      </div>
      <div className="opeartions">
        <div data-type='normalButton' role="button" onClick={() => {
          showModal('WatchLocalDir');
        }}>导入文件夹</div>
      </div>
      <div className="music-list-container">
        <MusicList musicList={localMusicList} virtualProps={{
          fallbackRenderCount: -1
        }}></MusicList>
      </div>
    </div>
  );
}
