/**
 * Evt send by Main process
 */
export enum IpcMainEvt {}

/**
 * Evt send by Renderer process
 */
export enum IpcRendererEvt {
  GET_GLOBAL_DATA = "shared/global-data/get-global-data",
}
