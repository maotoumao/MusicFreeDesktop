import MusicSheet from "@/renderer/core/music-sheet";
import Base from "../Base";
import "./index.scss";
import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import albumImg from "@/assets/imgs/album-cover.jpg";
import addImg from "@/assets/imgs/add.png";
import { hideModal, showModal } from "../..";
import { Trans, useTranslation } from "react-i18next";

interface IAddMusicToSheetProps {
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[];
}

export default function AddMusicToSheet(props: IAddMusicToSheetProps) {
  const { musicItems } = props;
  const { t } = useTranslation();

  const allSheets = MusicSheet.frontend.useAllSheets();
  return (
    <Base withBlur={false}>
      <div className="modal--add-music-to-sheet-container shadow backdrop-color">
        <Base.Header>
          <span>
            {t("modal.add_to_my_sheets")}{" "}
            <span className="music-length">
              (
              <Trans
                i18nKey={"modal.total_music_num"}
                values={{
                  number: Array.isArray(musicItems) ? musicItems.length : 1,
                }}
              ></Trans>
              )
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
            <span>{t("modal.create_local_sheet")}</span>
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
