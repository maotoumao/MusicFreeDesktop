import MusicSheet from "@/renderer/core/music-sheet";
import Base from "../Base";
import "./index.scss";
import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import albumImg from "@/assets/imgs/album-cover.jpg";
import addImg from "@/assets/imgs/add.png";
import { hideModal, showModal } from "../..";

interface IAddMusicToSheetProps {
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[];
}

export default function AddMusicToSheet(props: IAddMusicToSheetProps) {
  const { musicItems } = props;

  const allSheets = MusicSheet.frontend.useAllSheets();
  return (
    <Base withBlur={false}>
      <div className="modal--add-music-to-sheet-container shadow backdrop-color">
        <Base.Header>
          <span>
            添加到歌单{" "}
            <span className="music-length">
              (共{Array.isArray(musicItems) ? musicItems.length : 1}首)
            </span>
          </span>
        </Base.Header>
        <div className="music-sheets">
          <div
            className="sheet-item"
            role="button"
            onClick={() => {
              showModal("AddNewSheet", {
                initMusicItems: musicItems,
              });
            }}
          >
            <img src={addImg}></img>
            <span>新建歌单</span>
          </div>
          {allSheets.map((sheet) => (
            <div
              className="sheet-item"
              key={sheet.id}
              role="button"
              onClick={() => {
                MusicSheet.frontend.addMusicToSheet(musicItems, sheet.id);
                hideModal();
              }}
            >
              <img
                src={sheet.artwork ?? albumImg}
                onError={setFallbackAlbum}
              ></img>
              <span>{sheet.title}</span>
            </div>
          ))}
        </div>
      </div>
    </Base>
  );
}
