import SvgAsset, { SvgAssetIconNames } from "@/renderer/components/SvgAsset";
import "./index.scss";

interface IOptionItemProps {
  iconName: SvgAssetIconNames;
  onClick?: () => void;
}

export function OptionItem(props: IOptionItemProps) {
  const { iconName, onClick } = props;

  return (
    <div role="button" onClick={onClick} className="music-detail--option-item">
      <SvgAsset iconName={iconName}></SvgAsset>
    </div>
  );
}
