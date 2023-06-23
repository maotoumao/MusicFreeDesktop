import { useCallback, useState } from "react";
import Base from "../Base";
import "./index.scss";
import MusicSheet from "@/renderer/core/music-sheet";
import debounce from "@/common/debounce";
import { hideModal } from "../..";
import SimpleInputWithState from "../SimpleInputWithState";

interface IProps {
  initMusicItems: IMusic.IMusicItem | IMusic.IMusicItem[];
}

export default function AddNewSheet(props: IProps) {
  const [newSheetName, setNewSheetName] = useState("");

  const onCreateNewSheetClick = useCallback(
    debounce(async (newSheetName) => {
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
    []
  );

  return (
    <SimpleInputWithState
      title="新建歌单"
      onOk={onCreateNewSheetClick}
      placeholder="请输入新建歌单名称"
      maxLength={30}
      okText="创建"
    ></SimpleInputWithState>
  );
}
