import * as player from "./player";
import * as playerEnum from "./enum";
import trackPlayerEventsEmitter from "./event";

type IEvtHandlerType = <
  T extends playerEnum.TrackPlayerEventParams,
  K extends keyof T & (string | symbol)
>(
  eventName: K,
  callBack: (payload: T[K]) => void
) => void;

export default {
  ...player,
  ...playerEnum,
  on: trackPlayerEventsEmitter.on.bind(
    trackPlayerEventsEmitter
  ) as IEvtHandlerType,
  off: trackPlayerEventsEmitter.off.bind(
    trackPlayerEventsEmitter
  ) as IEvtHandlerType,
};
