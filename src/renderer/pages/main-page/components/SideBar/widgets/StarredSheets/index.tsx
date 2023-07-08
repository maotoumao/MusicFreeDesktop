import "./index.scss";
import ListItem from "../ListItem";
import { useMatch, useNavigate } from "react-router-dom";
import { Disclosure } from "@headlessui/react";
import MusicSheet, {
  defaultSheet,
  starredSheetsStore,
} from "@/renderer/core/music-sheet";
import { localPluginName } from "@/common/constant";
import { showContextMenu } from "@/renderer/components/ContextMenu";

export default function StarredSheets() {
  const sheetIdMatch = useMatch(`/main/musicsheet/:platform/:sheetId`);

  const currentPlatform = sheetIdMatch?.params?.platform;
  const currentSheetId = sheetIdMatch?.params?.sheetId;

  const starredSheets = starredSheetsStore.useValue();

  const navigate = useNavigate();

  return (
    <div className="side-bar-container--starred-sheets">
      <Disclosure defaultOpen>
        <Disclosure.Button className="title" as="div" role="button">
          <div className="my-sheets">我的收藏</div>
        </Disclosure.Button>
        <Disclosure.Panel>
          {starredSheets.map((item) => (
            <ListItem
              key={item.id}
              iconName={"musical-note"}
              onClick={() => {
                currentSheetId !== item.id &&
                  currentPlatform !== item.platform &&
                  navigate(`/main/musicsheet/${item.platform}/${item.id}`, {
                    state: {
                      sheetItem: item,
                    },
                  });
              }}
              onContextMenu={(e) => {
                showContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  menuItems: [
                    {
                      title: "取消收藏",
                      icon: "trash",
                      onClick() {
                        MusicSheet.unstarMusicSheet(item).then(() => {
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
