import ListItem from "./widgets/ListItem";
import "./index.scss";
import MySheets from "./widgets/MySheets";
import { useMatch, useNavigate } from "react-router";

export default function () {
  const navigate = useNavigate();
  const routePathMatch = useMatch("/main/:routePath");


  const options = [
    {
      iconName: "trophy",
      title: "排行榜",
      route: "toplist",
    },
    {
      iconName: "fire",
      title: "热门歌单",
      route: "recommend-sheets",
    },
    // {
    //   iconName: "array-download-tray",
    //   title: "下载管理",
    //   route: "download",
    // },
    {
      iconName: "folder-open",
      title: "本地音乐",
      route: "local-music",
    },
    {
      iconName: "code-bracket-square",
      title: "插件管理",
      route: "plugin-manager-view",
    },
  ] as const;

  return (
    <div className="side-bar-container">
      {options.map((item) => (
        <ListItem
          key={item.route}
          iconName={item.iconName}
          title={item.title}
          selected={routePathMatch?.params?.routePath === item.route}
          onClick={() => {
            navigate(`/main/${item.route}`);
          }}
        ></ListItem>
      ))}
      <MySheets></MySheets>
    </div>
  );
}
