import { Tab } from "@headlessui/react";
import React from "react";
import { useTranslation } from "react-i18next";
import RemoteThemes from "./components/RemoteThemes";
import LocalThemes from "./components/LocalThemes";

const routes = ["local", "remote"];

export default function ThemeView() {
  const { t } = useTranslation();

  return (
    <div id="page-container" className="page-container">
      <Tab.Group>
        <Tab.List className="tab-list-container">
          {routes.map((it) => (
            <Tab key={it} as="div" className="tab-list-item">
              {t(`theme.tab_${it}`)}
            </Tab>
          ))}
        </Tab.List>
        <Tab.Panels className={"tab-panels-container"}>
          <Tab.Panel>
            <LocalThemes></LocalThemes>
          </Tab.Panel>
          <Tab.Panel>
            <RemoteThemes></RemoteThemes>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}
