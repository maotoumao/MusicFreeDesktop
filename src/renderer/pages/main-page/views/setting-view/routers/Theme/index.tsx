import { IAppConfig } from "@/common/app-config/type";
import "./index.scss";
import classNames from "@/renderer/utils/classnames";
import { useEffect, useState } from "react";
import {
  IContextMenuItem,
  showContextMenu,
} from "@/renderer/components/ContextMenu";
import { toast } from "react-toastify";
import SvgAsset from "@/renderer/components/SvgAsset";
import { ipcRendererInvoke } from "@/common/ipc-util/renderer";
import A from "@/renderer/components/A";

interface IProps {
  data: IAppConfig["theme"];
}

export default function Theme(props: IProps) {
  // const { data = {} as IAppConfig["theme"] } = props;
  // console.log(data);
  const allThemePacksStore = window.themepack.allThemePacksStore;
  const currentThemePackStore = window.themepack.currentThemePackStore;
  const [currentThemePack, setCurrentThemePack] = useState<ICommon.IThemePack>(
    currentThemePackStore.getValue()
  );
  const [allThemePacks, setAllThemePacks] = useState<
    Array<ICommon.IThemePack | null>
  >(allThemePacksStore.getValue());

  useEffect(() => {
    const unsub1 = allThemePacksStore.onValueChange((newValue) => {
      setAllThemePacks(newValue);
    });
    const unsub2 = currentThemePackStore.onValueChange((newValue) => {
      setCurrentThemePack(newValue);
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  return (
    <div className="setting-view--theme-container">
      <div className="setting-row">💡这里有些示例主题：<A href="https://github.com/maotoumao/MusicFreeThemePacks">https://github.com/maotoumao/MusicFreeThemePacks</A></div>
      <div className="setting-row">⭐也可以关注公众号：<span className="highlight"> 一只猫头猫 </span>，回复<span className="highlight"> MusicFree主题包 </span>获取下载地址 (不定期更新)</div>
      <div className="setting-view--theme-items">
        <ThemeItem
          selected={currentThemePack === null}
          themePack={null}
        ></ThemeItem>
        {allThemePacks?.map((item) => (
          <ThemeItem
            key={item.path}
            themePack={item}
            selected={item.path === currentThemePack?.path}
          ></ThemeItem>
        ))}
        <div
          className="theme-item-container"
          role="button"
          title="安装主题"
          onClick={async () => {
            const result = await ipcRendererInvoke("show-open-dialog", {
              title: "安装主题包",
              buttonLabel: "安装",
              filters: [{
                "name": "MusicFree主题",
                "extensions": ["mftheme", "zip"]
              }, {
                name: "全部文件",
                extensions: ["*"]
              }],
              properties: ["openFile", "multiSelections"],
            });
            console.log(result);
            if (!result.canceled) {
              const themePackPaths = result.filePaths;
              for(const themePackPath of themePackPaths) {
                const [code, reason] = await window.themepack.installThemePack(
                  themePackPath
                );
                if (code) {
                  toast.success(`安装主题${reason?.name ? `「${reason.name}」` : ""}成功~`);
                } else {
                  toast.error(`安装主题失败: ${reason?.message ?? ""}`);
                }
              }
            }
          }}
        >
          <div className="theme-item-preview install-theme-pack">
            <SvgAsset iconName="plus"></SvgAsset>
          </div>
        </div>
      </div>
    </div>
  );
}

interface IThemeItemProps {
  selected: boolean;
  themePack: ICommon.IThemePack | null;
}

export function showThemeContextMenu(
  themePack: ICommon.IThemePack,
  x: number,
  y: number
) {
  const menuItems: IContextMenuItem[] = [];

  menuItems.push(
    // {
    //   title: "刷新主题",
    //   icon: "motion-play",
    //   onClick() {
    //     trackPlayer.addNext(musicItems);
    //   },
    // },
    {
      title: "卸载主题",
      icon: "trash",
      async onClick() {
        const [code, reason] = await window.themepack.uninstallThemePack(
          themePack
        );

        if (code) {
          toast.success("卸载成功~");
        } else {
          toast.error(`卸载失败: ${reason?.message ?? ""}`);
        }
      },
    }
  );

  showContextMenu({
    x,
    y,
    menuItems,
  });
}

function ThemeItem(props: IThemeItemProps) {
  const { selected, themePack } = props;
  return (
    <div
      className="theme-item-container"
      role="button"
      onClick={() => {
        window.themepack.selectTheme(themePack);
      }}
      onContextMenu={(e) => {
        if (!themePack) {
          return;
        }
        showThemeContextMenu(themePack, e.clientX, e.clientY);
      }}
      title={themePack?.description}
    >
      <div
        className={classNames({
          "theme-item-preview": true,
          "theme-item-preview-selected": selected,
        })}
        style={{
          background:
            themePack === null
              ? "#f17d34"
              : themePack.preview.startsWith("#")
              ? themePack.preview
              : `center/cover no-repeat url(${themePack.preview})`,
        }}
      ></div>
      <div className="theme-item-title">
        {themePack ? themePack.name : "默认"}
      </div>
    </div>
  );
}
