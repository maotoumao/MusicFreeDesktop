import Store from "@/common/store";
import SvgAsset, { SvgAssetIconNames } from "../SvgAsset";
import "./index.scss";
import Condition, { If, IfTruthy } from "../Condition";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

export interface IContextMenuItem {
    /** 左侧图标 */
    icon?: SvgAssetIconNames;
    /** 列表标题 */
    title?: string;
    /** 是否是分割线 */
    divider?: boolean;
    /** 是否展示 */
    show?: boolean;
    /** 点击事件 */
    onClick?: (value?: IContextMenuItem) => void;
    /** 子菜单 */
    subMenu?: IContextMenuItem[];
}

interface IContextMenuData {
    /** 菜单 */
    menuItems?: IContextMenuItem[];
    /** 出现位置 x */
    x: number;
    /** 出现位置 y */
    y: number;
    /** 设置子目录 */
    setSubMenu?: (
        subMenu?: Omit<IContextMenuData, "setSubMenu">,
        menuItem?: IContextMenuItem
    ) => void;
    onItemClick?: (value: any) => void;

    /** 自定义的菜单 */
    width?: number;
    height?: number;
    component?: ReactNode;
}

const contextMenuDataStore = new Store<IContextMenuData | null>(null);

export function showContextMenu(
    contextMenuData: Pick<IContextMenuData, "menuItems" | "x" | "y">,
) {
    contextMenuDataStore.setValue(contextMenuData);
}

export function showCustomContextMenu(
    contextMenuData: Pick<
        IContextMenuData,
    "x" | "y" | "width" | "height" | "component"
    >,
) {
    contextMenuDataStore.setValue(contextMenuData);
}

function hideContextMenu() {
    contextMenuDataStore.setValue(null);
}

const menuItemWidth = 240;
const menuItemHeight = 32;
const menuContainerMaxHeight = menuItemHeight * 10;

function SingleColumnContextMenuComponent(props: IContextMenuData) {
    const { menuItems, x, y, setSubMenu, onItemClick } = props;
    const menuContainerRef = useRef<HTMLDivElement>();

    return (
        <div
            className="context-menu--single-column-container shadow backdrop-color"
            style={{
                width: menuItemWidth,
                paddingTop: menuItemHeight / 4,
                paddingBottom: menuItemHeight / 4,
                top: y,
                left: x,
                maxHeight: menuContainerMaxHeight,
            }}
            ref={menuContainerRef}
        >
            {menuItems.map((item, index) => (
                <IfTruthy condition={item.show !== false} key={index}>
                    <If condition={!item.divider}>
                        <If.Falsy>
                            <div className="divider"></div>
                        </If.Falsy>
                        <If.Truthy>
                            <div
                                className="menu-item"
                                role="button"
                                onClick={() => {
                                    item.onClick?.();
                                    onItemClick?.(item);
                                }}
                                onMouseEnter={(e) => {
                                    const subMenu = item.subMenu;
                                    if (!subMenu) {
                                        setSubMenu?.(null, item);
                                        return;
                                    }

                                    const realPos =
                    y +
                    (e.target as HTMLDivElement).offsetTop -
                    menuContainerRef.current.scrollTop;
                                    const realHeight = Math.min(
                                        subMenu.length * menuItemHeight,
                                        menuContainerMaxHeight,
                                    );
                                    let [subX, subY] = [
                                        x - menuItemWidth - offset,
                                        realPos - realHeight / 2,
                                    ];
                                    if (x < window.innerWidth - x - offset - menuItemWidth) {
                                        subX = x + menuItemWidth + offset;
                                    }
                                    if (subY < 54) {
                                        subY = 54;
                                    }
                                    if (subY + realHeight > window.innerHeight - 64 - offset) {
                                        subY = window.innerHeight - 64 - realHeight - offset;
                                    }
                                    setSubMenu?.(
                                        {
                                            menuItems: subMenu,
                                            x: subX,
                                            y: subY,
                                        },
                                        item,
                                    );
                                }}
                                style={{
                                    height: menuItemHeight,
                                }}
                            >
                                <IfTruthy condition={item.icon}>
                                    <div className="menu-item-icon">
                                        <SvgAsset iconName={item.icon}></SvgAsset>
                                    </div>
                                </IfTruthy>
                                <span>{item.title}</span>
                                <IfTruthy condition={item.subMenu}>
                                    <div className="menu-item-expand"></div>
                                </IfTruthy>
                            </div>
                        </If.Truthy>
                    </If>
                </IfTruthy>
            ))}
        </div>
    );
}

const offset = 6;

export function ContextMenuComponent() {
    const contextMenuData = contextMenuDataStore.useValue();
    const { menuItems, x, y, width, height, component } = contextMenuData ?? {};
    const [subMenuData, setSubMenuData] = useState<IContextMenuData | null>(null);

    const [actualX, actualY] = useMemo(() => {
        if (x === undefined || y === undefined) {
            return [-1000, -1000];
        }
        const isLeft = x < window.innerWidth / 2 ? 0 : 1;
        const isTop = y < window.innerHeight / 2 ? 0 : 2;
    
        const containerHeight = Math.min(
            component
                ? height
                : menuItems.reduce(
                    (prev, curr) =>
                        prev +
              (curr.show !== false ? (curr.divider ? 1 : menuItemHeight) : 0),
                    menuItemHeight / 2,
                ),
            menuContainerMaxHeight,
        );

        const containerWidth = width ?? menuItemWidth;

        switch (isLeft + isTop) {
            case 0: // 左上角
                return [x + offset, y + offset];
            case 1: // 右上角
                return [x - containerWidth - offset, y + offset];
            case 2: // 左下角
                return [x + offset, y - offset - containerHeight];
            case 3: // 右下角
                return [x - containerWidth - offset, y - offset - containerHeight];
        }
    }, [x, y]);

    useEffect(() => {
        const contextClickListener = () => {
            if (contextMenuDataStore.getValue()) {
                hideContextMenu();
            }
        };

        window.addEventListener("click", contextClickListener);
        return () => {
            window.removeEventListener("click", contextClickListener);
        };
    }, []);

    useEffect(() => {
        setSubMenuData(null);
    }, [contextMenuData]);


    return (
        <If condition={contextMenuData !== null && !component}>
            <If.Truthy>
                <SingleColumnContextMenuComponent
                    menuItems={menuItems}
                    x={actualX}
                    y={actualY}
                    setSubMenu={(data, menuItem) => {
                        setSubMenuData(
                            data
                                ? {
                                    ...data,
                                    onItemClick(value) {
                                        menuItem?.onClick?.(value);
                                    },
                                }
                                : data,
                        );
                    }}
                ></SingleColumnContextMenuComponent>
                <Condition condition={subMenuData}>
                    <SingleColumnContextMenuComponent
                        menuItems={subMenuData?.menuItems}
                        x={subMenuData?.x}
                        y={subMenuData?.y}
                        onItemClick={subMenuData?.onItemClick}
                    ></SingleColumnContextMenuComponent>
                </Condition>
            </If.Truthy>
            <If.Falsy>
                <div
                    className="context-menu--single-column-container shadow backdrop-color"
                    style={{
                        width: width ?? menuItemWidth,
                        top: actualY,
                        left: actualX,
                        maxHeight: menuContainerMaxHeight,
                    }}
                >
                    {component}
                </div>
            </If.Falsy>
        </If>
    );
}
