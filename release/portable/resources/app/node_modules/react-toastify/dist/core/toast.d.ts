import { OnChangeCallback } from './eventManager';
import { ToastContent, ToastOptions, Id, UpdateOptions, ClearWaitingQueueParams, TypeOptions } from '../types';
declare function toast<TData = unknown>(content: ToastContent<TData>, options?: ToastOptions): Id;
declare namespace toast {
    var loading: <TData = unknown>(content: ToastContent<TData>, options?: ToastOptions<{}> | undefined) => Id;
    var promise: typeof handlePromise;
    var success: <TData = unknown>(content: ToastContent<TData>, options?: ToastOptions<{}> | undefined) => Id;
    var info: <TData = unknown>(content: ToastContent<TData>, options?: ToastOptions<{}> | undefined) => Id;
    var error: <TData = unknown>(content: ToastContent<TData>, options?: ToastOptions<{}> | undefined) => Id;
    var warning: <TData = unknown>(content: ToastContent<TData>, options?: ToastOptions<{}> | undefined) => Id;
    var warn: <TData = unknown>(content: ToastContent<TData>, options?: ToastOptions<{}> | undefined) => Id;
    var dark: (content: ToastContent, options?: ToastOptions<{}> | undefined) => Id;
    var dismiss: (id?: Id | undefined) => void;
    var clearWaitingQueue: (params?: ClearWaitingQueueParams) => void;
    var isActive: (id: Id) => boolean;
    var update: <TData = unknown>(toastId: Id, options?: UpdateOptions<TData>) => void;
    var done: (id: Id) => void;
    var onChange: (callback: OnChangeCallback) => () => void;
    var POSITION: {
        TOP_LEFT: import("../types").ToastPosition;
        TOP_RIGHT: import("../types").ToastPosition;
        TOP_CENTER: import("../types").ToastPosition;
        BOTTOM_LEFT: import("../types").ToastPosition;
        BOTTOM_RIGHT: import("../types").ToastPosition;
        BOTTOM_CENTER: import("../types").ToastPosition;
    };
    var TYPE: {
        INFO: TypeOptions;
        SUCCESS: TypeOptions;
        WARNING: TypeOptions;
        ERROR: TypeOptions;
        DEFAULT: TypeOptions;
    };
}
export interface ToastPromiseParams<TData = unknown, TError = unknown, TPending = unknown> {
    pending?: string | UpdateOptions<TPending>;
    success?: string | UpdateOptions<TData>;
    error?: string | UpdateOptions<TError>;
}
declare function handlePromise<TData = unknown, TError = unknown, TPending = unknown>(promise: Promise<TData> | (() => Promise<TData>), { pending, error, success }: ToastPromiseParams<TData, TError, TPending>, options?: ToastOptions): Promise<TData>;
export { toast };
