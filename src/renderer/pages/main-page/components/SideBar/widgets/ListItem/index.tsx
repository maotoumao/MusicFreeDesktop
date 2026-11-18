import { forwardRef } from "react";
import SvgAsset, { SvgAssetIconNames } from "@/renderer/components/SvgAsset";
import "./index.scss";

interface IProps {
    selected?: boolean;
    onClick?: () => void;
    onDoubleClick?: () => void;
    onContextMenu?: (...args: any) => void;
    iconName?: SvgAssetIconNames;
    title?: string;
}

/**
 * ref 转发出去了：侧边栏「我的歌单」在定位当前歌曲时需要拿到目标项
 * 的 DOM 来做 scrollIntoView。
 */
const ListItem = forwardRef<HTMLDivElement, IProps>(function ListItem(
    props,
    ref,
) {
    const {
        selected,
        onClick,
        onDoubleClick,
        iconName,
        title,
        onContextMenu,
    } = props ?? {};
    return (
        <div
            ref={ref}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
            title={title}
            role="button"
            className="side-bar--list-item-container"
            data-selected={selected}
        >
            {iconName ? <SvgAsset iconName={iconName}></SvgAsset> : null}
            <span>{title ?? ""}</span>
        </div>
    );
});

export default ListItem;
