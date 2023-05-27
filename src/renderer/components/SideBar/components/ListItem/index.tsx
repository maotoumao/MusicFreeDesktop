import SvgAsset, { SvgAssetIconNames } from "@/renderer/components/SvgAsset";
import "./index.scss";

interface IProps {
  selected?: boolean;
  onClick?: () => void;
  iconName?: SvgAssetIconNames;
  title?: string;
}

export default function ListItem(props: IProps) {
  const { selected, onClick, iconName, title } = props ?? {};
  return (
    <div
      onClick={onClick}
      role="button"
      className="side-bar--list-item-container"
      data-selected={selected}
    >
      {iconName ? <SvgAsset iconName={iconName}></SvgAsset> : null}
      {title ?? ""}
    </div>
  );
}
