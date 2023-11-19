import Store from "@/common/store";
import templates from "./templates";
import { useMemo } from "react";

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

  const component = useMemo(() => {
    if (modalState.type) {
      const Component = templates[modalState.type];
      return <Component {...(modalState.payload ?? {})}></Component>;
    }
    return null;
  }, [modalState]);

  return component;
}

export function showPanel<T extends keyof ITemplate>(
  type: T,
  payload?: Parameters<ITemplate[T]>[0]
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