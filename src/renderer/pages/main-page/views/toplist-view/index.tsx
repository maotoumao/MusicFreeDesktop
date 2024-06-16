import Condition from "@/renderer/components/Condition";
import MusicSheetlikeItem from "@/renderer/components/MusicSheetlikeItem";
import { Tab } from "@headlessui/react";
import { getSortedSupportedPlugin } from "@/renderer/core/plugin-delegate";
import { pluginsTopListStore } from "./store";
import { RequestStateCode } from "@/common/constant";
import Loading from "@/renderer/components/Loading";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import useGetTopList from "./hooks/useGetTopList";
import NoPlugin from "@/renderer/components/NoPlugin";
import Empty from "@/renderer/components/Empty";
import { useTranslation } from "react-i18next";

import "./index.scss";

export default function ToplistView() {
  const availablePlugins = getSortedSupportedPlugin("getTopLists");
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div id="page-container" className="page-container toplist-view--container">
      <Condition
        condition={availablePlugins.length}
        falsy={
          <NoPlugin
            supportMethod={t("plugin.method_get_top_lists")}
            height={"100%"}
          ></NoPlugin>
        }
      >
        <Tab.Group
          defaultIndex={history.state?.usr?.pluginIndex}
          onChange={(index) => {
            const usr = history.state.usr ?? {};

            navigate("", {
              replace: true,
              state: {
                ...usr,
                pluginIndex: index,
              },
            });
          }}
        >
          <Tab.List className="tab-list-container">
            {availablePlugins.map((plugin) => (
              <Tab key={plugin.hash} as="div" className="tab-list-item">
                {plugin.platform}
              </Tab>
            ))}
          </Tab.List>
          <Tab.Panels className={"tab-panels-container"}>
            {availablePlugins.map((plugin) => (
              <Tab.Panel className="tab-panel-container" key={plugin.hash}>
                <ToplistBody plugin={plugin}></ToplistBody>
              </Tab.Panel>
            ))}
          </Tab.Panels>
        </Tab.Group>
      </Condition>
    </div>
  );
}

interface IToplistBodyProps {
  plugin: IPlugin.IPluginDelegate;
}

function ToplistBody(props: IToplistBodyProps) {
  const topLists = pluginsTopListStore.useValue();
  const { plugin } = props;
  const getTopList = useGetTopList();

  useEffect(() => {
    getTopList(plugin.hash);
  }, []);

  return (
    <Condition
      condition={
        topLists[plugin.hash]?.state !== RequestStateCode.PENDING_FIRST_PAGE
      }
      falsy={<Loading></Loading>}
    >
      <Condition
        condition={topLists[plugin.hash]?.data?.length}
        falsy={<Empty></Empty>}
      >
        {topLists[plugin.hash]?.data?.map((item, index) => (
          <ToplistGroupItem
            groupItem={item}
            key={index}
            platform={plugin.platform}
          ></ToplistGroupItem>
        ))}
      </Condition>
    </Condition>
  );
}

interface IToplistGroupItemProps {
  groupItem: IMusic.IMusicSheetGroupItem;
  platform: string;
}
function ToplistGroupItem(props: IToplistGroupItemProps) {
  const { groupItem, platform } = props;
  const navigate = useNavigate();

  return (
    <div className="toplist-group-item--container">
      <Condition condition={groupItem.title}>
        <div className="header">{groupItem.title}</div>
      </Condition>
      <div className="body">
        {groupItem.data.map((item) => (
          <MusicSheetlikeItem
            key={item.id}
            mediaItem={item}
            onClick={(mediaItem) => {
              navigate(`/main/toplist-detail/${platform}`, {
                state: {
                  toplist: {
                    ...mediaItem,
                    platform,
                  },
                },
              });
            }}
          ></MusicSheetlikeItem>
        ))}
      </div>
    </div>
  );
}
