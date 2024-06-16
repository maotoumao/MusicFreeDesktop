import { Tab } from "@headlessui/react";
import "./index.scss";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SwitchCase from "@/renderer/components/SwitchCase";
import MusicResult from "./widgets/MusicResult";
import AlbumResult from "./widgets/AlbumResult";

interface IBodyProps {
  artistItem: IArtist.IArtistItem;
}

const supportedMediaType = ["music", "album"];
export default function Body(props: IBodyProps) {
  const { artistItem } = props;
  const [currentMediaType, setCurrentMediaType] = useState("music");
  const { t } = useTranslation();

  return (
    <div className="artist-view--body-container">
      <Tab.Group
        onChange={(index) => {
          setCurrentMediaType(supportedMediaType[index]);
        }}
      >
        <Tab.List className="tab-list-container">
          {supportedMediaType.map((type) => (
            <Tab key={type} as="div" className="tab-list-item">
              {t(`media.media_type_${type}`)}
            </Tab>
          ))}
        </Tab.List>
        <Tab.Panels className={"tab-panels-container"}>
          {supportedMediaType.map((type) => (
            <Tab.Panel className="tab-panel-container" key={type}>
              <SwitchCase.Switch switch={type}>
                <SwitchCase.Case case={"music"}>
                  <MusicResult artistItem={artistItem}></MusicResult>
                </SwitchCase.Case>
                <SwitchCase.Case case={"album"}>
                  <AlbumResult artistItem={artistItem}></AlbumResult>
                </SwitchCase.Case>
              </SwitchCase.Switch>
            </Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}
