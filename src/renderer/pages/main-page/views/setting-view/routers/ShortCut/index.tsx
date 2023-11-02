import { IAppConfig } from "@/common/app-config/type";
import "./index.scss";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import { useEffect, useMemo, useRef, useState } from "react";

import hotkeys from "hotkeys-js";
import rendererAppConfig from "@/common/app-config/renderer";
import { bindShortCut } from "@/renderer/core/shortcut";
import { ipcRendererSend } from "@/common/ipc-util/renderer";
import raf2 from "@/renderer/utils/raf2";
interface IProps {
  data: IAppConfig["shortCut"];
}

let recordShortCutKey: string[] = [];
let isAllModifierKey = false;

export default function ShortCut(props: IProps) {
  const { data = {} as IAppConfig["shortCut"] } = props;
  useEffect(() => {
    hotkeys(
      "*",
      {
        capture: true,
      },
      (evt, detail) => {
        const target = evt.target as HTMLElement;
        if (
          target.tagName === "INPUT" &&
          target.dataset["capture"] === "true"
        ) {
          const pressedKeys = hotkeys.getPressedKeyString();
          const _recordShortCutKey = [];
          isAllModifierKey = false;
          if (hotkeys.ctrl) {
            _recordShortCutKey.push("Ctrl");
            isAllModifierKey = true;
          }
          if (hotkeys.shift) {
            _recordShortCutKey.push("Shift");
            isAllModifierKey = true;
          }
          if (hotkeys.alt) {
            _recordShortCutKey.push("Alt");
            isAllModifierKey = true;
          }
          // 跟一个普通键
          for (let i = pressedKeys.length - 1; i >= 0; --i) {
            if (!hotkeys.modifier[pressedKeys[i]]) {
              _recordShortCutKey.push(
                pressedKeys[i].replace(/^(.)/, (_, $1: string) =>
                  $1.toUpperCase()
                )
              );
              isAllModifierKey = false;
              break;
            }
          }
          recordShortCutKey = _recordShortCutKey;
        }
      }
    );
    return () => {
      hotkeys.unbind("*");
    };
  }, []);

  return (
    <div className="setting-view--short-cut-container">
      <CheckBoxSettingItem
        keyPath="shortCut.enableLocal"
        checked={data.enableLocal}
        label="启用软件内快捷键"
      ></CheckBoxSettingItem>
      <CheckBoxSettingItem
        keyPath="shortCut.enableGlobal"
        checked={data.enableGlobal}
        onCheckChanged={(val) => {
          ipcRendererSend("enable-global-short-cut", val);
        }}
        label="启用全局快捷键"
      ></CheckBoxSettingItem>
      <ShortCutTable
        shortCuts={data.shortcuts ?? {}}
        enableLocal={data.enableLocal ?? true}
        enableGlobal={data.enableGlobal ?? false}
      ></ShortCutTable>
    </div>
  );
}

type IShortCutKeys = keyof IAppConfig["shortCut"]["shortcuts"];
const translations: Record<IShortCutKeys, string> = {
  "play/pause": "播放/暂停",
  "skip-next": "播放下一首",
  "skip-previous": "播放上一首",
  "volume-up": "增加音量",
  "volume-down": "减少音量",
  "toggle-desktop-lyric": "打开/关闭桌面歌词",
  "like/dislike": "喜欢/不喜欢当前歌曲",
};

const shortCutKeys = Object.keys(translations) as IShortCutKeys[];

interface IShortCutTableProps {
  shortCuts: Partial<IAppConfig["shortCut"]["shortcuts"]>;
  enableLocal: boolean;
  enableGlobal: boolean;
}
function ShortCutTable(props: IShortCutTableProps) {
  const { shortCuts, enableGlobal, enableLocal } = props;

  return (
    <div className="setting-view--short-cut-table-container">
      <div className="setting-view--short-cut-table-row">
        <div className="short-cut-cell">功能</div>
        <div className="short-cut-cell">软件快捷键</div>
        <div className="short-cut-cell">全局快捷键</div>
      </div>
      {shortCutKeys.map((it) => (
        <div className="setting-view--short-cut-table-row" key={it}>
          <div className="short-cut-cell">
            {translations[it as IShortCutKeys]}
          </div>
          <div className="short-cut-cell">
            <ShortCutItem
              enabled={enableLocal}
              value={shortCuts[it]?.local}
              onChange={(val) => {
                bindShortCut(it as IShortCutKeys, val);
                rendererAppConfig.setAppConfigPath(
                  `shortCut.shortcuts.${it}.local`,
                  val
                );
              }}
            ></ShortCutItem>
          </div>
          <div className="short-cut-cell">
            <ShortCutItem
              enabled={enableGlobal}
              value={shortCuts[it]?.global}
              onChange={(val) => {
                console.log(it, val);
                bindShortCut(it as IShortCutKeys, val, true);
              }}
            ></ShortCutItem>
          </div>
        </div>
      ))}
    </div>
  );
}

interface IShortCutItemProps {
  enabled?: boolean;
  value?: string[];
  onChange?: (sc?: string[]) => void;
}

function formatValue(val: string[]) {
  return val.join(" + ");
}

function ShortCutItem(props: IShortCutItemProps) {
  const { value, onChange, enabled } = props;
  const [realValue, setRealValue] = useState(formatValue(value ?? []));
  const isRecordingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>();
  // todo 写的很奇怪
  const resultRef = useRef<string[]>([]);
  const isAllModifierKeyRef = useRef(false);

  const keyupHandler = () =>
    raf2(() => {
      const isAllModifierKey = isAllModifierKeyRef.current;
      const recordShortCutKey = resultRef.current;
      if (isRecordingRef.current) {
        if (isAllModifierKey || !recordShortCutKey.length) {
          setRealValue(formatValue(value ?? []));
        } else if (
          recordShortCutKey.includes("Backspace")
        ) {
          setRealValue("");
          onChange?.([]);
        } else {
          setRealValue(formatValue(recordShortCutKey));
          onChange?.(recordShortCutKey);
        }
      }
      isAllModifierKeyRef.current = false;
      resultRef.current = [];

      isRecordingRef.current = false;
    });

  return (
    <input
      data-capture="true"
      data-disabled={!enabled}
      readOnly
      className="short-cut-item--container"
      ref={inputRef}
      value={realValue || "空"}
      onKeyDown={(e) => {
        e.preventDefault();
        raf2(() => {
          resultRef.current = recordShortCutKey.filter(
            (it) => it !== "Backspace"
          );
          isAllModifierKeyRef.current = isAllModifierKey;
          setRealValue(
            `${resultRef.current.join(" + ")}${isAllModifierKey ? " +" : ""}`
          );
          if (isRecordingRef.current) {
            return;
          } else {
            isRecordingRef.current = true;
          }
        });
      }}
      onKeyUp={keyupHandler}
      onBlur={keyupHandler}
    ></input>
  );
}
