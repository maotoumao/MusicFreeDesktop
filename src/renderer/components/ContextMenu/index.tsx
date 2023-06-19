import Store from "@/common/store";
import SvgAsset, { SvgAssetIconNames } from "../SvgAsset";
import "./index.scss";
import Condition from "../Condition";
import { useEffect, useMemo } from "react";

interface IContextMenuItem {
  /** 左侧图标 */
  icon?: SvgAssetIconNames;
  /** 列表标题 */
  title?: string;
  /** 是否是分割线 */
  divider?: boolean;
  /** 是否展示 */
  show?: boolean;
  /** 点击事件 */
  onClick?: () => void;
  /** 子菜单 */
  subMenu?: Omit<IContextMenuItem, "subMenu">[];
}

interface IContextMenuData {
  /** 菜单 */
  menuItems: IContextMenuItem[];
  /** 出现位置 x */
  x: number;
  /** 出现位置 y */
  y: number;
}

const contextMenuDataStore = new Store<IContextMenuData | null>(null);

export function showContextMenu(contextMenuData: IContextMenuData) {
  contextMenuDataStore.setValue(contextMenuData);
}

function hideContextMenu() {
  contextMenuDataStore.setValue(null);
}

const menuItemWidth = 240;
const menuItemHeight = 32;
const menuContainerMaxHeight = menuItemHeight * 10

function SingleColumnContextMenuComponent(props: IContextMenuData) {
  const { menuItems, x, y } = props;

  return (
    <div
      className="context-menu--single-column-container"
      style={{
        width: menuItemWidth,
        paddingTop: menuItemHeight / 4,
        paddingBottom: menuItemHeight / 4,
        top: y,
        left: x,
        maxHeight: menuContainerMaxHeight
      }}
    >
      {menuItems.map((item, index) => (
        <Condition condition={item.show !== false} key={index}>
          <Condition
            condition={!item.divider}
            falsy={<div className="divider"></div>}
          >
            <div
              className="menu-item"
              role="button"
              onClick={item.onClick}
              style={{
                height: menuItemHeight,
              }}
            >
              <Condition condition={item.icon}>
                <div className="menu-item-icon">
                  <SvgAsset iconName={item.icon}></SvgAsset>
                </div>
              </Condition>
              {item.title}
            </div>
          </Condition>
        </Condition>
      ))}
    </div>
  );
}

const offset = 6;

export function ContextMenuComponent() {
  const contextMenuData = contextMenuDataStore.useValue();
  const { menuItems, x, y } = contextMenuData ?? {};

  const [actualX, actualY] = useMemo(() => {
    if (x === undefined || y === undefined) {
      return [-1000, -1000];
    }
    const isLeft = x < window.innerWidth / 2 ? 0 : 1;
    const isTop = y < window.innerHeight / 2 ? 0 : 2;
    const validItemsHeight = Math.min(menuItems.reduce(
      (prev, curr) =>
        prev +
        (curr.show !== false ? (curr.divider ? 1 : menuItemHeight) : 0),
      menuItemHeight / 2
    ), menuContainerMaxHeight);
    
    console.log(isLeft + isTop);
    switch (isLeft + isTop) {
      case 0:
        return [x + offset, y + offset];
      case 1:
        return [x - menuItemWidth - offset, y + offset];
      case 2:
        return [x + offset, y - offset - validItemsHeight];
      case 3:
        return [x - menuItemWidth - offset, y - offset - validItemsHeight];
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

  return (
    <Condition condition={contextMenuData !== null}>
      <SingleColumnContextMenuComponent
        menuItems={menuItems}
        x={actualX}
        y={actualY}
      ></SingleColumnContextMenuComponent>
    </Condition>
  );
}
