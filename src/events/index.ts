import EventEmitter from "eventemitter3";
import { useEffect } from "react";

class _Evt {
  private ee: EventEmitter;

  constructor() {
    this.ee = new EventEmitter();
  }

  /**
   * 监听
   * @param eventName 事件名
   * @param callBack 回调
   */
  on<T extends IEventType.IEvents, K extends keyof T & (string | symbol)>(
    eventName: K,
    callBack: (payload: T[K]) => void
  ) {
    this.ee.on(eventName, callBack);
  }

  once<T extends IEventType.IEvents, K extends keyof T & (string | symbol)>(
    eventName: K,
    callBack: (payload: T[K]) => void
  ) {
    this.ee.once(eventName, callBack);
  }

  emit<T extends IEventType.IEvents, K extends keyof T & (string | symbol)>(
    eventName: K,
    payload?: T[K]
  ) {
    this.ee.emit(eventName, payload);
  }

  off<T extends IEventType.IEvents, K extends keyof T & (string | symbol)>(
    eventName: K,
    callBack: (payload: T[K]) => void
  ) {
    this.ee.off(eventName, callBack);
  }

  use<T extends IEventType.IEvents, K extends keyof T & (string | symbol)>(
    eventName: K,
    callBack: (payload: T[K]) => void
  ) {
    useEffect(() => {
      this.ee.on(eventName, callBack);
      return () => {
        this.ee.off(eventName, callBack);
      };
    }, []);
  }
}

const Evt = new _Evt();
export default Evt;