import localMusicListStore from "@/renderer/core/local-music/store";
import "./index.scss";
import { useMemo, useState } from "react";
import groupBy from "@/renderer/utils/groupBy";
import MusicList from "@/renderer/components/MusicList";
import { Trans } from "react-i18next";

interface IProps {
  localMusicList: IMusic.IMusicItem[];
}

export default function FolderView(props: IProps) {
  const { localMusicList } = props;

  const [keys, allMusic] = useMemo(() => {
    const grouped = groupBy(localMusicList ?? [], (it) =>
      window.path.dirname(it.$$localPath)
    );
    return [Object.keys(grouped).sort((a, b) => a.localeCompare(b)), grouped];
  }, [localMusicList]);

  const [selectedKey, setSelectedKey] = useState<string>();

  const actualSelectedKey = selectedKey ?? keys?.[0];

  return (
    <div className="local-music--folder-view-container">
      <div className="left-part">
        {keys.map((it) => (
          <div
            className="folder-item list-behavior"
            key={it}
            data-selected={actualSelectedKey === it}
            onClick={() => {
              setSelectedKey(it);
            }}
          >
            <span>{it}</span>
            <span>
              <Trans
                i18nKey={"local_music_page.total_music_num"}
                values={{
                  number: allMusic?.[it]?.length ?? 0,
                }}
              ></Trans>
            </span>
          </div>
        ))}
      </div>
      <div className="right-part">
        <MusicList
          musicList={allMusic[actualSelectedKey] ?? []}
          hideRows={["artist"]}
          virtualProps={{
            fallbackRenderCount: -1,
          }}
        ></MusicList>
      </div>
    </div>
  );
}
