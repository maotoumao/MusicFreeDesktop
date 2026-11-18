import { Transport } from "../transport";
export declare class Polling extends Transport {
    maxHttpBufferSize: number;
    httpCompression: any;
    private res;
    private dataReq;
    private dataRes;
    private shouldClose;
    private readonly closeTimeout;
    /**
     * HTTP polling constructor.
     *
     * @api public.
     */
    constructor(req: any);
    /**
     * Transport name
     *
     * @api public
     */
    get name(): string;
    get supportsFraming(): boolean;
    /**
     * Overrides onRequest.
     *
     * @param req
     *
     * @api private
     */
    onRequest(req: any): void;
    /**
     * The client sends a request awaiting for us to send data.
     *
     * @api private
     */
    onPollRequest(req: any, res: any): void;
    /**
     * The client sends a request with data.
     *
     * @api private
     */
    onDataRequest(req: any, res: any): void;
    /**
     * Cleanup request.
     *
     * @api private
     */
    private onDataRequestCleanup;
    /**
     * Processes the incoming data payload.
     *
     * @param {String} encoded payload
     * @api private
     */
    onData(data: any): void;
    /**
     * Overrides onClose.
     *
     * @api private
     */
    onClose(): void;
    /**
     * Writes a packet payload.
     *
     * @param {Object} packet
     * @api private
     */
    send(packets: any): void;
    /**
     * Writes data as response to poll request.
     *
     * @param {String} data
     * @param {Object} options
     * @api private
     */
    write(data: any, options: any): void;
    /**
     * Performs the write.
     *
     * @api private
     */
    doWrite(data: any, options: any, callback: any): void;
    /**
     * Compresses data.
     *
     * @api private
     */
    compress(data: any, encoding: any, callback: any): void;
    /**
     * Closes the transport.
     *
     * @api private
     */
    doClose(fn: any): void;
    /**
     * Returns headers for a response.
     *
     * @param req - request
     * @param {Object} extra headers
     * @api private
     */
    headers(req: any, headers: any): any;
}
