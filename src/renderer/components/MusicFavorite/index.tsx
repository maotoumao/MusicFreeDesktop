import { useMusicIsFavorite } from "@/renderer/core/music-sheet/internal/sheets-method";
import SvgAsset from "../SvgAsset";
import MusicSheet from "@/renderer/core/music-sheet";

interface IMusicFavoriteProps {
  musicItem: IMusic.IMusicItem;
  size: number;
}

export default function MusicFavorite(props: IMusicFavoriteProps) {
  const { musicItem, size } = props;
  const isFav = useMusicIsFavorite(musicItem);
  
  return (
    <div
      role="button"
      onClick={() => {
        if (isFav) {
          MusicSheet.removeMusicFromFavorite(musicItem);
        } else {
          MusicSheet.addMusicToFavorite(musicItem);
        }
      }}
      style={{
        color: isFav ? "red" : "var(--textColor)",
        width: size,
        height: size,
      }}
    >
      <SvgAsset
        iconName={isFav ? "heart" : "heart-outline"}
        size={size}
      ></SvgAsset>
    </div>
  );
}
