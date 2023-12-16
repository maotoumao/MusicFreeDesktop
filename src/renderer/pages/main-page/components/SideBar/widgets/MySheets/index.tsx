import "./index.scss";
import ListItem from "../ListItem";
import { useMatch, useNavigate } from "react-router-dom";
import { Disclosure } from "@headlessui/react";
import MusicSheet, { defaultSheet } from "@/renderer/core/music-sheet";
import SvgAsset from "@/renderer/components/SvgAsset";
import { showModal } from "@/renderer/components/Modal";
import { localPluginName } from "@/common/constant";
import { showContextMenu } from "@/renderer/components/ContextMenu";

export default function MySheets() {
  const sheetIdMatch = useMatch(
    `/main/musicsheet/${encodeURIComponent(localPluginName)}/:sheetId`
  );
  const currentSheetId = sheetIdMatch?.params?.sheetId;
  const musicSheets = MusicSheet.frontend.useAllSheets();
  const navigate = useNavigate();

  return (
    <div className="side-bar-container--my-sheets">
      <div className="divider"></div>
      <Disclosure defaultOpen>
        <Disclosure.Button className="title" as="div" role="button">
          <div className="my-sheets ">我的歌单</div>
          <div
            role="button"
            className="add-new-sheet"
            title="新建歌单"
            onClick={(e) => {
              e.stopPropagation();
              showModal("AddNewSheet");
            }}
          >
            <SvgAsset iconName="plus-circle"></SvgAsset>
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
                      title: "删除歌单",
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
              title={item.title}
            ></ListItem>
          ))}
        </Disclosure.Panel>
      </Disclosure>
    </div>
  );
}
