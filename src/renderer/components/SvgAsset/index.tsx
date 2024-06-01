import { memo } from "react";

export type SvgAssetIconNames =
  | "album"
  | "array-download-tray"
  | "arrow-left-end-on-rectangle"
  | "cd"
  | "check"
  | "check-circle"
  | "chevron-double-down"
  | "chevron-double-up"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "code-bracket-square"
  | "cog-8-tooth"
  | "dashboard-speed"
  | "document-plus"
  | "fire"
  | "folder-open"
  | "font-size-larger"
  | "font-size-smaller"
  | "headphone"
  | "heart-outline"
  | "heart"
  | "identification"
  | "list-bullet"
  | "lock-closed"
  | "lock-open"
  | "logo"
  | "lyric"
  | "lyric-en"
  | "magnifying-glass"
  | "minus"
  | "motion-play"
  | "musical-note"
  | "pause"
  | "play"
  | "playlist"
  | "plus"
  | "plus-circle"
  | "question-mark-circle"
  | "repeat-song-1"
  | "repeat-song"
  | "rolling-1s"
  | "shuffle"
  | "skip-left"
  | "skip-right"
  | "sort"
  | "sort-asc"
  | "sort-desc"
  | "sparkles"
  | "speaker-wave"
  | "speaker-x-mark"
  | "trash"
  | "trophy"
  | "t-shirt-line"
  | "user"
  | "lq"
  | "sd"
  | "hq"
  | "sq"
  | "x-mark";

interface IProps {
  iconName: SvgAssetIconNames;
  size?: number;
  title?: string;
}
/**
 *
 * @param props
 * @returns
 */
function SvgAsset(props: IProps) {
  const Svg = require(`@/assets/icons/${props.iconName}.svg`);

  return (
    <Svg.default
      title={props.title}
      style={{
        width: props.size,
        height: props.size,
      }}
    ></Svg.default>
  );
}

export default memo(SvgAsset, (prev, curr) => prev.iconName === curr.iconName);
