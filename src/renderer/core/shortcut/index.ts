import hotkeys from "hotkeys-js";

import trackPlayer from "../track-player";
import { PlayerState, TrackPlayerEvent } from "../track-player/enum";
import { IAppConfig } from "@/shared/app-config/type";
import Evt from "../events";
import { shortCutKeys, shortCutKeysEvts } from "@/common/constant";
import { getAppConfigPath } from "@/shared/app-config/renderer";
import { ipcRendererSend } from "@/shared/ipc/renderer";

const originalHotkeysFilter = hotkeys.filter;

hotkeys.filter = (event) => {
  const target = event.target as HTMLElement;
  if (target.dataset["capture"] === "true") {
    return true;
  }
  return originalHotkeysFilter(event);
};

type IShortCutKeys = keyof IAppConfig["shortCut"]["shortcuts"];

const baseShortCutFunction = (
  evt: keyof IEventType.IEvents,
  global: boolean,
  originalEvt: KeyboardEvent
) => {
  originalEvt.preventDefault();
  if (global && getAppConfigPath("shortCut.enableGlobal")) {
  } else if (getAppConfigPath("shortCut.enableLocal")) {
    Evt.emit(evt);
  }
};

const localShortCutKeyFuncs = {} as Record<any, () => void>;
shortCutKeys.forEach((it) => {
  localShortCutKeyFuncs[it] = baseShortCutFunction.bind(
    undefined,
    shortCutKeysEvts[it],
    false
  );
});

const boundKeyMap = new Map<string, string[]>();
export function bindShortCut(
  key: IShortCutKeys,
  shortCut: string[],
  global = false
) {
  // 原有的快捷键
  const mapKey = `${key}${global ? "-g" : ""}`;
  // const originalHotKey = boundKeyMap.get(mapKey);
  // console.log(originalHotKey, shortCut);
  // if (originalHotKey?.join?.("+") === shortCut?.join?.("+")) {
  //   // 没改
  //   return;
  // }
  unbindShortCut(key, global);
  if (!shortCut?.length) {
    return;
  }
  if (global) {
    ipcRendererSend("bind-global-short-cut", {
      key: key,
      shortCut: shortCut,
    });
  } else {
    hotkeys(shortCut.join("+"), "all", localShortCutKeyFuncs[mapKey]);
  }

  boundKeyMap.set(mapKey, shortCut);
}

export function unbindShortCut(eventType: IShortCutKeys, global = false) {
  // 原有的快捷键
  const mapKey = `${eventType}${global ? "-g" : ""}`;

  const originalHotKey = boundKeyMap.get(mapKey);

  if (originalHotKey) {
    if (global) {
      ipcRendererSend("unbind-global-short-cut", {
        key: eventType,
        shortCut: originalHotKey,
      });
    } else {
      hotkeys.unbind(
        originalHotKey.join("+"),
        "all",
        localShortCutKeyFuncs[mapKey]
      );
    }
    boundKeyMap.delete(mapKey);
  }
}

export function setupLocalShortCut() {
  // 固定的快捷键
  shortCutKeys.forEach((it) => {
    const val = getAppConfigPath(`shortCut.shortcuts.${it}`);
    if (val && val.local && val.local.length) {
      bindShortCut(it, val.local);
    }
  });
}
