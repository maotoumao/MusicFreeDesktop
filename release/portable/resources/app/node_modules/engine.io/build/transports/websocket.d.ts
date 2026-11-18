import { Transport } from "../transport";
export declare class WebSocket extends Transport {
    protected perMessageDeflate: any;
    private socket;
    /**
     * WebSocket transport
     *
     * @param {http.IncomingMessage}
     * @api public
     */
    constructor(req: any);
    /**
     * Transport name
     *
     * @api public
     */
    get name(): string;
    /**
     * Advertise upgrade support.
     *
     * @api public
     */
    get handlesUpgrades(): boolean;
    /**
     * Advertise framing support.
     *
     * @api public
     */
    get supportsFraming(): boolean;
    /**
     * Writes a packet payload.
     *
     * @param {Array} packets
     * @api private
     */
    send(packets: any): void;
    /**
     * Whether the encoding of the WebSocket frame can be skipped.
     * @param packet
     * @private
     */
    private _canSendPreEncodedFrame;
    /**
     * Closes the transport.
     *
     * @api private
     */
    doClose(fn: any): void;
}
