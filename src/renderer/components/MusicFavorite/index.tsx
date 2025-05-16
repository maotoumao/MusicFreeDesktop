// src/renderer/components/MusicFavorite/index.tsx
import SvgAsset from "../SvgAsset";
import MusicSheet from "@/renderer/core/music-sheet";

interface IMusicFavoriteProps {
  musicItem: IMusic.IMusicItem | null; // 允许 musicItem 为 null
  size: number;
}

export default function MusicFavorite(props: IMusicFavoriteProps) {
  const { musicItem, size } = props;
  // useMusicIsFavorite 内部应该能处理 musicItem 为 null 的情况
  const isFav = MusicSheet.frontend.useMusicIsFavorite(musicItem);

  return (
    <div
      role="button"
      onClick={(e) => {
        e.stopPropagation();
        if (musicItem) { // 添加 musicItem 检查
          if (isFav) {
            MusicSheet.frontend.removeMusicFromFavorite(musicItem);
          } else {
            MusicSheet.frontend.addMusicToFavorite(musicItem);
          }
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
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