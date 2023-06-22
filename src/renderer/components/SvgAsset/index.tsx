import { memo } from "react";

export type SvgAssetIconNames =
  | "album"
  | "array-download-tray"
  | "chevron-double-down"
  | "chevron-double-up"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "code-bracket-square"
  | "cog-8-tooth"
  | 'document-plus'
  | "fire"
  | "headphone"
  | "heart-outline"
  | "heart"
  | "identification"
  | "logo"
  | "lyric"
  | "magnifying-glass"
  | "minus"
  | "motion-play"
  | "musical-note"
  | "pause"
  | "play"
  | "playlist"
  | "plus-circle"
  | "repeat-song-1"
  | "repeat-song"
  | "shuffle"
  | "skip-left"
  | "skip-right"
  | 'trash'
  | "trophy"
  | "user"
  | "x-mark";

interface IProps {
  iconName: SvgAssetIconNames;
  size?: number;
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
      style={{
        width: props.size,
        height: props.size,
      }}
    ></Svg.default>
  );
}

export default memo(SvgAsset, (prev, curr) => prev.iconName === curr.iconName);
