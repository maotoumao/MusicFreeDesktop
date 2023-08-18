import hotkeys from "hotkeys-js";

import trackPlayer from "../track-player";
import { PlayerState, TrackPlayerEvent } from "../track-player/enum";
import { IAppConfig } from "@/common/app-config/type";
import Evt from "../events";
import { shortCutKeys } from "@/common/constant";
import rendererAppConfig from "@/common/app-config/renderer";


const originalHotkeysFilter = hotkeys.filter;

hotkeys.filter = (event) => {
  const target = event.target as HTMLElement;
  if (target.dataset["capture"] === "true") {
    return true;
  }
  return originalHotkeysFilter(event);
};

type IShortCutKeys = keyof IAppConfig["shortCut"]["shortcuts"];

const shortCutKeysEvts: Record<IShortCutKeys, keyof IEventType.IEvents> = {
  "play/pause": "TOGGLE_PLAYER_STATE",
  "skip-next": "SKIP_NEXT",
  "skip-previous": "SKIP_PREVIOUS",
  "volume-down": "VOLUME_DOWN",
  "volume-up": "VOLUME_UP",
  "toggle-desktop-lyric": "TOGGLE_DESKTOP_LYRIC",
};

const baseShortCutFunction = (evt: keyof IEventType.IEvents) => {
  console.log("trigger", evt);
  Evt.emit(evt);
};

const shortCutKeyFuncs = Object.entries(shortCutKeysEvts)
  .map(([key, value]) => [key, baseShortCutFunction.bind(undefined, value)])
  .reduce((prev, curr) => {
    prev[curr[0] as string] = curr[1];
    return prev;
  }, {} as any);


const boundKeyMap = new Map<string, string[]>();
export function bindShortCut(
  eventType: IShortCutKeys,
  keys: string[],
  global = false
) {
  // 原有的快捷键
  const mapKey = `${eventType}${global ? "-g" : ""}`;
  unbindShortCut(eventType, global);
  hotkeys(keys.join("+"), shortCutKeyFuncs[eventType]);
  
  boundKeyMap.set(mapKey, keys);
}

export function unbindShortCut(eventType: IShortCutKeys, global = false) {
  // 原有的快捷键
  const mapKey = `${eventType}${global ? "-g" : ""}`;

  const originalHotKey = boundKeyMap.get(mapKey);
  if (originalHotKey) {
    hotkeys.unbind(originalHotKey.join("+"), shortCutKeyFuncs[eventType]);
    boundKeyMap.delete(mapKey);
  }
}

export function setupLocalShortCut() {
  // window.addEventListener("keydown", (e) => {
  //   if (e.key !== "Backspace") {
  //     currentPressedKeys.add(characterFromEvent(e));
  //   }
  // });

  // window.addEventListener("keyup", (e) => {
  //   console.log("keyup", e);
  //   currentPressedKeys.delete(characterFromEvent(e));
  // });

  // 固定的快捷键
  shortCutKeys.forEach(it => {
    const val = rendererAppConfig.getAppConfigPath(`shortCut.shortcuts.${it}`);
    if(val && val.local && val.local.length) {
      bindShortCut(it, val.local)
    }
  })

}
