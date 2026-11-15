import Store from "@/common/store";
import templates from "./templates";
import { useMemo } from "react";
import { createPortal } from "react-dom";

type ITemplate = typeof templates;
type IPanelType = keyof ITemplate;

interface IPanelInfo {
    type: IPanelType | null;
    payload: any;
}

const panelStore = new Store<IPanelInfo>({
    type: null,
    payload: null,
});

export default function PanelComponent() {
    const modalState = panelStore.useValue();

    return useMemo(() => {
        if (modalState.type) {
            const Component = templates[modalState.type];
            /**
             * 渲染到 body 下：
             * .body-container 会被主题包设置 z-index（如 1）从而形成独立的层叠上下文，
             * 若面板留在其中，其 z-index 无法与根层级的弹窗（Modal）比较。
             * 挂到 body 下后，面板与弹窗处于同一层级，可以正常比较 z-index。
             */
            return createPortal(
                <Component {...(modalState.payload ?? {})}></Component>,
                document.body,
            );
        }
        return null;
    }, [modalState]);
}

export function showPanel<T extends keyof ITemplate>(
    type: T,
    payload?: Parameters<ITemplate[T]>[0],
) {
    panelStore.setValue({
        type,
        payload,
    });
}

export function hidePanel() {
    panelStore.setValue({
        type: null,
        payload: null,
    });
}


export function getCurrentPanel(){
    return panelStore.getValue();
}
