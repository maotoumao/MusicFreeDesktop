import localMusicListStore from "@/renderer/core/local-music/store";
import { Tab } from "@headlessui/react";
import { useTranslation } from "react-i18next";

import './index.scss';

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
        <div data-type='normalButton'>导入文件夹</div>
      </div>
      <Tab.Group>
        <Tab.List className="tab-list-container">
          {displayBy.map((item, index) => (
            <Tab key={index} as="div" className="tab-list-item">
              {t(item)}
            </Tab>
          ))}
        </Tab.List>
        <Tab.Panels className={"tab-panels-container"}>
          {displayBy.map((item, index) => (
            <Tab.Panel className="tab-panel-container" key={index}></Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}
