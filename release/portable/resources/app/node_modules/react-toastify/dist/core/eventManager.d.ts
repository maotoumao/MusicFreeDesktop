/// <reference types="react" />
import { Id, ToastContent, ClearWaitingQueueParams, NotValidatedToastProps, ToastItem } from '../types';
import { ContainerInstance } from '../hooks';
export declare const enum Event {
    Show = 0,
    Clear = 1,
    DidMount = 2,
    WillUnmount = 3,
    Change = 4,
    ClearWaitingQueue = 5
}
type OnShowCallback = (content: ToastContent, options: NotValidatedToastProps) => void;
type OnClearCallback = (id?: Id) => void;
type OnClearWaitingQueue = (params: ClearWaitingQueueParams) => void;
type OnDidMountCallback = (containerInstance: ContainerInstance) => void;
type OnWillUnmountCallback = OnDidMountCallback;
export type OnChangeCallback = (toast: ToastItem) => void;
type Callback = OnShowCallback | OnClearCallback | OnClearWaitingQueue | OnDidMountCallback | OnWillUnmountCallback | OnChangeCallback;
type TimeoutId = ReturnType<typeof setTimeout>;
export interface EventManager {
    list: Map<Event, Callback[]>;
    emitQueue: Map<Event, TimeoutId[]>;
    on(event: Event.Show, callback: OnShowCallback): EventManager;
    on(event: Event.Clear, callback: OnClearCallback): EventManager;
    on(event: Event.ClearWaitingQueue, callback: OnClearWaitingQueue): EventManager;
    on(event: Event.DidMount, callback: OnDidMountCallback): EventManager;
    on(event: Event.WillUnmount, callback: OnWillUnmountCallback): EventManager;
    on(event: Event.Change, callback: OnChangeCallback): EventManager;
    off(event: Event, callback?: Callback): EventManager;
    cancelEmit(event: Event): EventManager;
    emit<TData>(event: Event.Show, content: React.ReactNode | ToastContent<TData>, options: NotValidatedToastProps): void;
    emit(event: Event.Clear, id?: string | number): void;
    emit(event: Event.ClearWaitingQueue, params: ClearWaitingQueueParams): void;
    emit(event: Event.DidMount, containerInstance: ContainerInstance): void;
    emit(event: Event.WillUnmount, containerInstance: ContainerInstance): void;
    emit(event: Event.Change, data: ToastItem): void;
}
export declare const eventManager: EventManager;
export {};
