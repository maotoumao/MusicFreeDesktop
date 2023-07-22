// 数据存储方案
import { useEffect, useState } from "react";

export class StateMapper<T> {
  private getFun: () => T;
  public cbs: Set<() => void> = new Set([]);
  constructor(getFun: () => T) {
    this.getFun = getFun;
  }

  notify = () => {
    this.cbs.forEach((_) => _?.());
  };

  useMappedState = () => {
    const [_state, _setState] = useState<T>(this.getFun);

    const updateState = () => {
      _setState(this.getFun());
    };
    useEffect(() => {
      this.cbs.add(updateState);
      return () => {
        this.cbs.delete(updateState);
      };
    }, []);
    return _state;
  };
}

type UpdateFunc<T> = (prev: T) => T;

export default class Store<T> {
  private value: T;
  private stateMapper: StateMapper<T>;
  private valueChangeCbs: Set<(newValue: T, oldValue: T) => void> = new Set([]);

  constructor(initValue: T) {
    this.value = initValue;
    this.stateMapper = new StateMapper(this.getValue);
  }

  public getValue = () => {
    return this.value;
  };

  public useValue = () => {
    return this.stateMapper.useMappedState();
  };

  public setValue = (value: T | UpdateFunc<T>) => {
    let newValue: T;
    if (typeof value === "function") {
      newValue = (value as UpdateFunc<T>)(this.value);
    } else {
      newValue = value;
    }
    this.valueChangeCbs.forEach((cb) => {
      cb(newValue, this.value);
    });
    this.value = newValue;
    this.stateMapper.notify();
  };

  public onValueChange = (cb: (newValue: T, oldValue: T) => void) => {
    this.valueChangeCbs.add(cb);

    return () => {
      this.valueChangeCbs.delete(cb);
    };
  };
}

export function useStore<T>(store: Store<T>) {
  return [store.useValue(), store.setValue] as const;
}
