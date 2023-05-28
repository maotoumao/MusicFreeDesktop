import { useState } from "react";
import { closeModal, showModal } from "../Modal";
import ListItem from "./widgets/ListItem";
import "./index.scss";
import MySheets from "./widgets/MySheets";

export default function () {

  const [s, setS] = useState(true);

  return (
    <div className="side-bar-container">
      <ListItem iconName="trophy" title="排行榜"></ListItem>
      <ListItem iconName="fire" title="热门歌单" selected></ListItem>
      <ListItem
      iconName="array-download-tray"
        title="下载管理"
        onClick={() => {
          showModal("base", {
            withBlur: false,
            onDefaultClick() {
              closeModal();
            },
            children: (
              <div
                style={{
                  width: "200px",
                  height: "200px",
                  backgroundColor: "red",
                }}
              ></div>
            ),
          });
        }}
      ></ListItem>
      <ListItem iconName="code-bracket-square" title="插件管理" selected={s} onClick={() => {
        setS(_ => !_)
      }}></ListItem>
      <MySheets></MySheets>
    </div>
  );
}
