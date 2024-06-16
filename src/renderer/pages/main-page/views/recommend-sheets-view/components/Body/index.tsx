import { useEffect, useState } from "react";
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
import { i18n } from "@/shared/i18n/renderer";

export function getDefaultTag(): IMedia.IUnique {
  return {
    title: i18n.t("common.default"),
    id: "",
  };
}

interface IBodyProps {
  plugin: IPlugin.IPluginDelegate;
}

export default function Body(props: IBodyProps) {
  const { plugin } = props;
  // 选中的tag
  const [selectedTag, setSelectedTag] = useState<IMedia.IUnique | null>(null);

  // 第一个tag
  const [firstTag, setFirstTag] = useState<IMedia.IUnique>(getDefaultTag);

  const tags = useRecommendListTags(plugin);
  //   const tags: any[] = [];

  const [showPanel, setShowPanel] = useState(false);

  const [query, sheets, status] = useRecommendSheets(plugin, selectedTag);

  const navigate = useNavigate();

  useEffect(() => {
    if (tags) {
      const cachedTag = history.state?.usr?.tag;
      if (cachedTag) {
        if (tags.pinned?.findIndex?.((it) => it.id === cachedTag.id) === -1) {
          setFirstTag(cachedTag);
        }
        setSelectedTag(cachedTag);
      } else {
        setSelectedTag(getDefaultTag);
      }
    }
  }, [tags]);

  return (
    <div className="recommend-sheet-view--body-container">
      <div className="tags-container">
        <TagPanel
          show={showPanel}
          tagsGroups={tags?.data}
          onTagClick={(tag) => {
            setSelectedTag(tag);
            setFirstTag(tag);
            const usr = history.state.usr ?? {};

            navigate("", {
              replace: true,
              state: {
                ...usr,
                tag: tag,
              },
            });
            setShowPanel(false);
          }}
        ></TagPanel>
        <div
          className={classNames({
            "first-tag": true,
            highlight: selectedTag?.id === firstTag.id,
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
        {tags?.pinned?.map?.((tag) => (
          <div
            key={tag.id}
            className={classNames({
              "pinned-tag": true,
              highlight: selectedTag?.id === tag.id,
            })}
            role="button"
            data-type="normalButton"
            title={tag.title}
            onClick={() => {
              setSelectedTag(tag);
              const usr = history.state.usr ?? {};

              navigate("", {
                replace: true,
                state: {
                  ...usr,
                  tag: tag,
                },
              });
            }}
          >
            {tag.title}
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
