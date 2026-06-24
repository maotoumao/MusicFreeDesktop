import SvgAsset, { SvgAssetIconNames } from "@/renderer/components/SvgAsset";
import classNames from "@/renderer/utils/classnames";
import "./index.scss";

interface IProps {
    selected?: boolean;
    onClick?: () => void;
    onContextMenu?: (...args: any) => void;
    iconName?: SvgAssetIconNames;
    title?: string;
    className?: string;
}

export default function ListItem(props: IProps) {
    const { selected, onClick, iconName, title, onContextMenu, className } = props ?? {};
    return (
        <div
            onClick={onClick}
            onContextMenu={onContextMenu}
            title={title}
            role="button"
            className={classNames([
                "side-bar--list-item-container",
                className ?? "",
            ])}
            data-selected={selected}
        >
            {iconName ? <SvgAsset iconName={iconName}></SvgAsset> : null}
            <span>{title ?? ""}</span>
        </div>
    );
}
