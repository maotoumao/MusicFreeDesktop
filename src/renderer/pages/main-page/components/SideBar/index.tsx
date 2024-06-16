import ListItem from "./widgets/ListItem";
import "./index.scss";
import MySheets from "./widgets/MySheets";
import { useMatch, useNavigate } from "react-router";
import StarredSheets from "./widgets/StarredSheets";
import { useTranslation } from "react-i18next";

export default function () {
  const navigate = useNavigate();
  const routePathMatch = useMatch("/main/:routePath");
  const { t } = useTranslation();

  const options = [
    {
      iconName: "trophy",
      title: t("side_bar.toplist"),
      route: "toplist",
    },
    {
      iconName: "fire",
      title: t("side_bar.recommend_sheets"),
      route: "recommend-sheets",
    },
    {
      iconName: "array-download-tray",
      title: t("side_bar.download_management"),
      route: "download",
    },
    {
      iconName: "folder-open",
      title: t("side_bar.local_music"),
      route: "local-music",
    },
    {
      iconName: "code-bracket-square",
      title: t("side_bar.plugin_management"),
      route: "plugin-manager-view",
    },
    {
      iconName: "clock",
      title: t("side_bar.recently_play"),
      route: "recently_play",
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
      <StarredSheets></StarredSheets>
    </div>
  );
}
