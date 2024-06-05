import { Tab } from "@headlessui/react";
import "./index.scss";
import Downloaded from "./components/Downloaded";
import Downloading from "./components/Downloading";
import { useTranslation } from "react-i18next";

export default function DownloadView() {
  const { t } = useTranslation();

  return (
    <div className="download-view--container">
      <Tab.Group>
        <Tab.List className="tab-list-container">
          <Tab as="div" className="tab-list-item">
            {t("common.downloaded")}
          </Tab>
          <Tab as="div" className="tab-list-item">
            {t("common.downloading")}
          </Tab>
        </Tab.List>
        <Tab.Panels className={"tab-panels-container"}>
          <Tab.Panel className="tab-panel-container">
            <Downloaded></Downloaded>
          </Tab.Panel>
          <Tab.Panel className="tab-panel-container">
            <Downloading></Downloading>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}
