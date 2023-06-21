import { useCallback, useState } from "react";
import Base from "../Base";
import "./index.scss";
import MusicSheet from "@/renderer/core/music-sheet";
import debounce from "@/common/debounce";
import { hideModal } from "../..";

interface IProps {
  initMusicItems: IMusic.IMusicItem | IMusic.IMusicItem[];
}

export default function AddNewSheet(props: IProps) {
  const [newSheetName, setNewSheetName] = useState("");

  const onCreateNewSheetClick = useCallback(
    debounce(async () => {
      try {
        const id = await MusicSheet.addSheet(newSheetName);
        if (props?.initMusicItems) {
          await MusicSheet.addMusicToSheet(props.initMusicItems, id);
        }
        hideModal();
      } catch {
        console.log("创建失败");
      }
    }, 500),
    [newSheetName]
  );

  return (
    <Base withBlur={false}>
      <div className="modal--add-new-sheet-container">
        <Base.Header>新建歌单</Base.Header>
        <div className="input-area">
          <input
            placeholder="请输入新建歌单名称"
            onChange={(e) => {
              setNewSheetName(e.target.value.slice(0, 30));
            }}
            value={newSheetName}
          ></input>
        </div>
        <div className="opeartion-area">
          <div
            role="button"
            data-type="primaryButton"
            data-disabled={newSheetName.length === 0}
            onClick={onCreateNewSheetClick}
          >
            创建
          </div>
        </div>
      </div>
    </Base>
  );
}
