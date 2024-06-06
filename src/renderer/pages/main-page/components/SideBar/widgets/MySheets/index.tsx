import "./index.scss";
import ListItem from "../ListItem";
import { useMatch, useNavigate } from "react-router-dom";
import { Disclosure } from "@headlessui/react";
import MusicSheet, { defaultSheet } from "@/renderer/core/music-sheet";
import SvgAsset from "@/renderer/components/SvgAsset";
import { hideModal, showModal } from "@/renderer/components/Modal";
import { localPluginName } from "@/common/constant";
import { showContextMenu } from "@/renderer/components/ContextMenu";
import { useTranslation } from "react-i18next";
import { useSupportedPlugin } from "@/renderer/core/plugin-delegate";

export default function MySheets() {
  const sheetIdMatch = useMatch(
    `/main/musicsheet/${encodeURIComponent(localPluginName)}/:sheetId`
  );
  const currentSheetId = sheetIdMatch?.params?.sheetId;
  const musicSheets = MusicSheet.frontend.useAllSheets();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const importablePlugins = useSupportedPlugin("importMusicSheet");

  return (
    <div className="side-bar-container--my-sheets">
      <div className="divider"></div>
      <Disclosure defaultOpen>
        <Disclosure.Button className="title" as="div" role="button">
          <div className="my-sheets">{t("side_bar.my_sheets")}</div>
          <div
            role="button"
            className="option-btn"
            title={t("plugin.method_import_music_sheet")}
            onClick={(e) => {
              e.stopPropagation();
              showModal("ImportMusicSheet", {
                plugins: importablePlugins,
              });
            }}
          >
            <SvgAsset iconName="arrow-left-end-on-rectangle"></SvgAsset>
          </div>
          <div
            role="button"
            className="option-btn"
            title={t("side_bar.create_local_sheet")}
            onClick={(e) => {
              e.stopPropagation();
              showModal("AddNewSheet");
            }}
          >
            <SvgAsset iconName="plus"></SvgAsset>
          </div>
        </Disclosure.Button>
        <Disclosure.Panel>
          {musicSheets.map((item) => (
            <ListItem
              key={item.id}
              iconName={
                item.id === defaultSheet.id ? "heart-outline" : "musical-note"
              }
              onClick={() => {
                currentSheetId !== item.id &&
                  navigate(`/main/musicsheet/${localPluginName}/${item.id}`);
              }}
              onContextMenu={(e) => {
                if (item.id === defaultSheet.id) {
                  return;
                }
                showContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  menuItems: [
                    {
                      title: t("side_bar.rename_sheet"),
                      icon: "pencil-square",
                      show: item.id !== defaultSheet.id,
                      onClick() {
                        showModal("SimpleInputWithState", {
                          placeholder: t(
                            "modal.create_local_sheet_placeholder"
                          ),
                          maxLength: 30,
                          title: t("side_bar.rename_sheet"),
                          defaultValue: item.title,
                          async onOk(text) {
                            await MusicSheet.frontend.updateSheet(item.id, {
                              title: text,
                            });
                            hideModal();
                          },
                        });
                      },
                    },
                    {
                      title: t("side_bar.delete_sheet"),
                      icon: "trash",
                      show: item.id !== defaultSheet.id,
                      onClick() {
                        MusicSheet.frontend.removeSheet(item.id).then(() => {
                          if (currentSheetId === item.id) {
                            navigate(
                              `/main/musicsheet/${localPluginName}/${defaultSheet.id}`,
                              {
                                replace: true,
                              }
                            );
                          }
                        });
                      },
                    },
                  ],
                });
              }}
              selected={currentSheetId === item.id}
              title={
                item.id === defaultSheet.id
                  ? t("media.default_favorite_sheet_name")
                  : item.title
              }
            ></ListItem>
          ))}
        </Disclosure.Panel>
      </Disclosure>
    </div>
  );
}
