import { ToastPosition, TypeOptions } from '../types';
type KeyOfPosition = 'TOP_LEFT' | 'TOP_RIGHT' | 'TOP_CENTER' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT' | 'BOTTOM_CENTER';
type KeyOfType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'DEFAULT';
/**
 * @deprecated
 */
export declare const POSITION: {
    [key in KeyOfPosition]: ToastPosition;
};
/**
 * @deprecated
 */
export declare const TYPE: {
    [key in KeyOfType]: TypeOptions;
};
export declare const enum Type {
    INFO = "info",
    SUCCESS = "success",
    WARNING = "warning",
    ERROR = "error",
    DEFAULT = "default"
}
export declare const enum Default {
    COLLAPSE_DURATION = 300,
    DEBOUNCE_DURATION = 50,
    CSS_NAMESPACE = "Toastify",
    DRAGGABLE_PERCENT = 80
}
export declare const enum Direction {
    X = "x",
    Y = "y"
}
export declare const enum SyntheticEvent {
    ENTRANCE_ANIMATION_END = "d"
}
export {};
