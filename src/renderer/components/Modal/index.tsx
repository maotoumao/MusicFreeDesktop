import Store from "@/common/store";
import templates from "./templates";
import { useMemo } from "react";

type ITemplate = typeof templates;
type IModalType = keyof ITemplate;

interface IModalInfo {
    type: IModalType | null;
    payload: any;
}

const modalStore = new Store<IModalInfo>({
    type: null,
    payload: null,
});

export default function ModalComponent() {
    const modalState = modalStore.useValue();

    const component = useMemo(() => {
        if (modalState.type) {
            const Component = templates[modalState.type];
            return <Component {...(modalState.payload ?? {})}></Component>;
        }
        return null;
    }, [modalState]);

    return component;
}

export function showModal<T extends keyof ITemplate>(
    type: T,
    payload?: Parameters<ITemplate[T]>[0],
) {
    modalStore.setValue({
        type,
        payload,
    });
}

export function hideModal() {
    modalStore.setValue({
        type: null,
        payload: null,
    });
}
