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

const baseShortCutFunction = (
  evt: keyof IEventType.IEvents,
  global: boolean
) => {
  if (global && rendererAppConfig.getAppConfigPath("shortCut.enableGlobal")) {
  } else if (rendererAppConfig.getAppConfigPath("shortCut.enableLocal")) {
    Evt.emit(evt);
  }
};

const shortCutKeyFuncs = {} as Record<any, () => void>;
shortCutKeys.forEach((it) => {
  shortCutKeyFuncs[it] = baseShortCutFunction.bind(
    undefined,
    shortCutKeysEvts[it],
    false
  );
  shortCutKeyFuncs[`${it}-g`] = baseShortCutFunction.bind(
    undefined,
    shortCutKeysEvts[it],
    true
  );
});

const boundKeyMap = new Map<string, string[]>();
export function bindShortCut(
  eventType: IShortCutKeys,
  keys: string[],
  global = false
) {
  // 原有的快捷键
  const mapKey = `${eventType}${global ? "-g" : ""}`;
  unbindShortCut(eventType, global);
  console.log(shortCutKeyFuncs[mapKey]);
  hotkeys(keys.join("+"), shortCutKeyFuncs[mapKey]);

  boundKeyMap.set(mapKey, keys);
}

export function unbindShortCut(eventType: IShortCutKeys, global = false) {
  // 原有的快捷键
  const mapKey = `${eventType}${global ? "-g" : ""}`;

  const originalHotKey = boundKeyMap.get(mapKey);
  if (originalHotKey) {
    hotkeys.unbind(originalHotKey.join("+"), shortCutKeyFuncs[mapKey]);
    boundKeyMap.delete(mapKey);
  }
}

export function setupLocalShortCut() {
  // 固定的快捷键
  shortCutKeys.forEach((it) => {
    const val = rendererAppConfig.getAppConfigPath(`shortCut.shortcuts.${it}`);
    if (val && val.local && val.local.length) {
      bindShortCut(it, val.local);
    }
  });
}
