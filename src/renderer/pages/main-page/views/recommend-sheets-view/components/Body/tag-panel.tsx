import Condition from "@/renderer/components/Condition";
import { getDefaultTag } from ".";
import "./tag-panel.scss";

interface ITagPanelProps {
  show: boolean;
  tagsGroups: IMusic.IMusicSheetGroupItem[];
  onTagClick?: (tag: IMedia.IUnique) => void;
}

export default function TagPanel(props: ITagPanelProps) {
  const { show, onTagClick, tagsGroups } = props;
  const defaultTag = getDefaultTag();

  return (
    <div className="tag-panel--container shadow backdrop-color" data-show={show}>
      <div className="tag-group--container">
        <div
          role="button"
          className="tag-group--tag"
          data-type="normalButton"
          title={defaultTag.title}
          onClick={() => {
            onTagClick?.(defaultTag);
          }}
        >
          {defaultTag.title}
        </div>
      </div>
      {tagsGroups?.map?.((tagGroup, index) => (
        <div key={index} className="tag-group--container">
          <Condition condition={tagGroup.title}>
            <div className="tag-group--title">{tagGroup.title}</div>
          </Condition>
          <div className="tag-group--tags">
            {tagGroup.data.map((tag) => (
              <div
                key={tag.id}
                role="button"
                data-type="normalButton"
                className="tag-group--tag"
                title={tag.title}
                onClick={() => {
                  onTagClick?.(tag);
                }}
              >
                {tag.title}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
