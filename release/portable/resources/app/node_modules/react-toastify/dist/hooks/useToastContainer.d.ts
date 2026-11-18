/// <reference types="react" />
import { Id, ToastContainerProps, ToastProps, ToastContent, Toast, ToastPosition } from '../types';
interface QueuedToast {
    toastContent: ToastContent;
    toastProps: ToastProps;
    staleId?: Id;
}
export interface ContainerInstance {
    toastKey: number;
    displayedToast: number;
    props: ToastContainerProps;
    containerId?: Id | null;
    isToastActive: (toastId: Id) => boolean;
    getToast: (id: Id) => Toast | null | undefined;
    queue: QueuedToast[];
    count: number;
}
export declare function useToastContainer(props: ToastContainerProps): {
    getToastToRender: <T>(cb: (position: ToastPosition, toastList: Toast[]) => T) => T[];
    containerRef: import("react").MutableRefObject<null>;
    isToastActive: (id: Id) => boolean;
};
export {};
