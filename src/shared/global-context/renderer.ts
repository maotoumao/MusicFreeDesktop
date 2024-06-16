import type { IGlobalContext } from "./type";

const mod = window["@shared/global-context" as any] as any;

export const getGlobalContext: () => IGlobalContext = mod.getGlobalContext;
