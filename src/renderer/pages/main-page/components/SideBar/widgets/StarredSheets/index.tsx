import "./index.scss";
import ListItem from "../ListItem";
import { useMatch, useNavigate } from "react-router-dom";
import { Disclosure } from "@headlessui/react";
import MusicSheet, { defaultSheet } from "@/renderer/core/music-sheet";
import { localPluginName } from "@/common/constant";
import { showContextMenu } from "@/renderer/components/ContextMenu";
import { useTranslation } from "react-i18next";

export default function StarredSheets() {
  const sheetIdMatch = useMatch("/main/musicsheet/:platform/:sheetId");

  const currentPlatform = sheetIdMatch?.params?.platform;
  const currentSheetId = sheetIdMatch?.params?.sheetId;

  const starredSheets = MusicSheet.frontend.useAllStarredSheets();

  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="side-bar-container--starred-sheets">
      <Disclosure defaultOpen>
        <Disclosure.Button className="title" as="div" role="button">
          <div className="my-sheets">{t("side_bar.starred_sheets")}</div>
        </Disclosure.Button>
        <Disclosure.Panel>
          {starredSheets.map((item) => (
            <ListItem
              key={item.id}
              iconName={"musical-note"}
              onClick={() => {
                if (
                  !(
                    currentSheetId === item.id &&
                    currentPlatform === item.platform
                  )
                ) {
                  // 如果不是相同歌单
                  navigate(`/main/musicsheet/${item.platform}/${item.id}`, {
                    state: {
                      sheetItem: item,
                    },
                  });
                }
              }}
              onContextMenu={(e) => {
                showContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  menuItems: [
                    {
                      title: t("side_bar.unstar_sheet"),
                      icon: "trash",
                      onClick() {
                        MusicSheet.frontend.unstarMusicSheet(item).then(() => {
                          if (
                            currentSheetId === item.id &&
                            currentPlatform === item.platform
                          ) {
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
              selected={
                currentSheetId === item.id && currentPlatform === item.platform
              }
              title={item.title}
            ></ListItem>
          ))}
        </Disclosure.Panel>
      </Disclosure>
    </div>
  );
}
