import { useState } from "react";
import "./index.scss";
import classNames from "@/renderer/utils/classnames";
import useRecommendListTags from "../../hooks/useRecommendListTags";
import TagPanel from "./tag-panel";
import useRecommendSheets from "../../hooks/useRecommendSheets";
import MusicSheetlikeList from "@/renderer/components/MusicSheetlikeList";
import Condition from "@/renderer/components/Condition";
import { RequestStateCode } from "@/common/constant";
import Loading from "@/renderer/components/Loading";
import { useNavigate } from "react-router-dom";

export const defaultTag: IMedia.IUnique = {
  title: "默认",
  id: "",
};

interface IBodyProps {
  plugin: IPlugin.IPluginDelegate;
}

export default function Body(props: IBodyProps) {
  const { plugin } = props;
  // 选中的tag
  const [selectedTag, setSelectedTag] = useState<IMedia.IUnique>(defaultTag);

  // 第一个tag
  const [firstTag, setFirstTag] = useState<IMedia.IUnique>(defaultTag);

  const tags = useRecommendListTags(plugin);
  //   const tags: any[] = [];

  const [showPanel, setShowPanel] = useState(false);

  const [query, sheets, status] = useRecommendSheets(plugin, selectedTag);

  const navigate = useNavigate();

  return (
    <div className="recommend-sheet-view--body-container">
      <div className="tags-container">
        <TagPanel
          show={showPanel}
          tagsGroups={tags?.data}
          onTagClick={(tag) => {
            setSelectedTag(tag);
            setFirstTag(tag);
            setShowPanel(false);
          }}
        ></TagPanel>
        <div
          className={classNames({
            "first-tag": true,
            highlight: selectedTag.id === firstTag.id,
          })}
          role="button"
          data-type="normalButton"
          data-panel-open={showPanel}
          title={firstTag.title}
          onClick={() => {
            setShowPanel((prev) => !prev);
          }}
        >
          {firstTag.title}
        </div>
        {tags?.pinned?.map?.((item) => (
          <div
            key={item.id}
            className={classNames({
              "pinned-tag": true,
              highlight: selectedTag.id === item.id,
            })}
            role="button"
            data-type="normalButton"
            title={item.title}
            onClick={() => {
              setSelectedTag(item);
            }}
          >
            {item.title}
          </div>
        ))}
      </div>
      <div className="list-container">
        <Condition
          condition={status !== RequestStateCode.PENDING_FIRST_PAGE}
          falsy={<Loading></Loading>}
        >
          <MusicSheetlikeList
            data={sheets}
            state={status}
            onLoadMore={() => {
              query();
            }}
            onClick={(sheetItem) => {
              navigate(
                `/main/musicsheet/${sheetItem.platform}/${sheetItem.id}`,
                {
                  state: {
                    sheetItem: sheetItem,
                  },
                }
              );
            }}
          ></MusicSheetlikeList>
        </Condition>
      </div>
    </div>
  );
}
