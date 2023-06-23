// 数据存储方案
import {useEffect, useState} from 'react';

export class StateMapper<T> {
    private getFun: () => T;
    private cbs: Set<() => void> = new Set([]);
    constructor(getFun: () => T) {
        this.getFun = getFun;
    }

    notify = () => {
        this.cbs.forEach(_ => _?.());
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
        if(typeof value === 'function') {
            this.value = (value as UpdateFunc<T>)(this.value);
        } else {
            this.value = value;
        }
        this.stateMapper.notify();
    };
}


export function useStore<T>(store: Store<T>) {
    return [store.useValue(), store.setValue] as const;
}