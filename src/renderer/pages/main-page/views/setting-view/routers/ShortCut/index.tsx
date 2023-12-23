import { IAppConfig } from "@/common/app-config/type";
import "./index.scss";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import { useEffect, useMemo, useRef, useState } from "react";

import hotkeys from "hotkeys-js";
import rendererAppConfig from "@/common/app-config/renderer";
import { bindShortCut } from "@/renderer/core/shortcut";
import { ipcRendererSend } from "@/common/ipc-util/renderer";

interface IProps {
  data: IAppConfig["shortCut"];
}

export default function ShortCut(props: IProps) {
  const { data = {} as IAppConfig["shortCut"] } = props;

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
  isGlobal?: boolean;
  value?: string[];
  onChange?: (sc?: string[]) => void;
}

function formatValue(val: string[]) {
  return val.join(" + ");
}

function keyCodeMap(code: string) {
  switch (code) {
    case "arrowup":
      return "Up";
    case "arrowdown":
      return "Down";
    case "arrowleft":
      return "Left";
    case "arrowright":
      return "Right";
    default:
      return code;
  }
}

function ShortCutItem(props: IShortCutItemProps) {
  const { value, onChange, enabled, isGlobal } = props;
  const [tmpValue, setTmpValue] = useState<string[] | null>();
  const realValue = formatValue(tmpValue ?? value ?? []);
  const isRecordingRef = useRef(false);
  const scopeRef = useRef(Math.random().toString().slice(2));
  const recordedKeysRef = useRef(new Set<string>());

  useEffect(() => {
    hotkeys(
      "*",
      {
        scope: scopeRef.current,
        keyup: true,
      },
      (evt) => {
        console.log(evt);
        const type = evt.type;
        let key = evt.key.toLowerCase();
        if (evt.code === "Space") {
          key = "Space";
        }
        if (type === "keydown") {
          isRecordingRef.current = true;
          if (key === "backspace") {
            // 删除
            setTmpValue(null);
            isRecordingRef.current = false;
            recordedKeysRef.current.clear();
            // 新的快捷键为空
            onChange?.([]);
          } else if (key === "meta") {
            setTmpValue(null);
            isRecordingRef.current = false;
            recordedKeysRef.current.clear();
          } else {
            if (!recordedKeysRef.current.has(key)) {
              recordedKeysRef.current.add(key);
              setTmpValue(
                [...recordedKeysRef.current].map((it) =>
                  it.replace(/^(.)/, (_, $1: string) => $1.toUpperCase())
                )
              );
            }
          }
        } else if (type === "keyup" && isRecordingRef.current) {
          isRecordingRef.current = false;
          // 开始结算
          const recordedSet = recordedKeysRef.current;
          const _recordShortCutKey = [];

          let statusCode = 0;
          if (recordedSet.has("ctrl") || recordedSet.has("control")) {
            _recordShortCutKey.push("Ctrl");
            recordedSet.delete("ctrl");
            recordedSet.delete("control");
            statusCode |= 1;
          }
          if (recordedSet.has("command")) {
            _recordShortCutKey.push("Command");
            recordedSet.delete("command");
            statusCode |= 1;
          }
          if (recordedSet.has("option")) {
            _recordShortCutKey.push("Option");
            recordedSet.delete("option");
            statusCode |= 1;
          }
          if (recordedSet.has("shift")) {
            _recordShortCutKey.push("Shift");
            recordedSet.delete("shift");
            statusCode |= 1;
          }

          if (recordedSet.has("alt")) {
            _recordShortCutKey.push("Alt");
            recordedSet.delete("alt");
            statusCode |= 1;
          }

          if (recordedSet.size === 1 && (isGlobal ? statusCode : true)) {
            _recordShortCutKey.push(
              keyCodeMap([...recordedSet.values()][0]).replace(
                /^(.)/,
                (_, $1: string) => $1.toUpperCase()
              )
            );
            setTmpValue(_recordShortCutKey);
            onChange?.(_recordShortCutKey);
          } else {
            setTmpValue(null);
          }

          recordedKeysRef.current.clear();
        }
      }
    );
  }, []);

  return (
    <input
      data-capture="true"
      data-disabled={!enabled}
      autoCorrect="off"
      autoCapitalize="off"
      type="text"
      readOnly
      aria-live="off"
      className="short-cut-item--container"
      value={realValue || "空"}
      onKeyDown={(e) => {
        e.preventDefault();
      }}
      onFocus={() => {
        hotkeys.setScope(scopeRef.current);
      }}
      onBlur={() => {
        hotkeys.setScope("all");
        setTmpValue(null);
        recordedKeysRef.current.clear();
      }}
    ></input>
  );
}
