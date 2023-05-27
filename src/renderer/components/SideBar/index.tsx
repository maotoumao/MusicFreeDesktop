import { closeModal, showModal } from "../Modal";
import ListItem from "./components/ListItem";
import "./index.scss";

export default function () {
  return (
    <div className="side-bar-container">
      <ListItem iconName="cog-8-tooth" title="排行榜"></ListItem>
      <ListItem title="热门歌单" selected></ListItem>
      <ListItem
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
      <ListItem iconName="heart-outline" title="本地音乐" selected></ListItem>
    </div>
  );
}
