declare module "@native/TaskbarThumbnailManager/TaskbarThumbnailManager.node" {
    interface ISize {
        width: number;
        height: number;
    }

    function config(hWnd: bigint): void; 
    function sendIconicRepresentation(hWnd: bigint, size: ISize, buf: Buffer);
    function sendLivePreviewBitmap(hWnd: bigint, size: ISize, buf: Buffer);
}