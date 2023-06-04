import "./index.scss";
import ListItem from "../ListItem";
import { useMatch, useNavigate } from "react-router-dom";
import { Disclosure } from "@headlessui/react";
import { defaultSheet, musicSheetsStore } from "@/renderer/core/music-sheet";

export default function MySheets() {
  const sheetIdMatch = useMatch("/main/mysheet/:sheetId");
  const currentSheetId = sheetIdMatch?.params?.sheetId;

  const musicSheets = musicSheetsStore.useValue();
  const navigate = useNavigate();

  return (
    <div className="side-bar-container--my-sheets">
      <div className="divider"></div>
      <Disclosure defaultOpen>
        <Disclosure.Button className="title" as="div" role="button">
          我的歌单
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
                  navigate(`/main/mysheet/${item.id}`);
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
