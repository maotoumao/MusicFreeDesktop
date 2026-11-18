/// <reference types="node" />
import { EventEmitter } from "events";
import { IncomingMessage } from "http";
import { Packet } from "engine.io-parser";
declare type ReadyState = "open" | "closing" | "closed";
export declare abstract class Transport extends EventEmitter {
    sid: string;
    writable: boolean;
    protocol: number;
    protected _readyState: ReadyState;
    protected discarded: boolean;
    protected parser: any;
    protected req: IncomingMessage & {
        cleanup: Function;
    };
    protected supportsBinary: boolean;
    get readyState(): ReadyState;
    set readyState(state: ReadyState);
    /**
     * Transport constructor.
     *
     * @param {http.IncomingMessage} req
     * @api public
     */
    constructor(req: any);
    /**
     * Flags the transport as discarded.
     *
     * @api private
     */
    discard(): void;
    /**
     * Called with an incoming HTTP request.
     *
     * @param {http.IncomingMessage} req
     * @api protected
     */
    protected onRequest(req: any): void;
    /**
     * Closes the transport.
     *
     * @api private
     */
    close(fn?: any): void;
    /**
     * Called with a transport error.
     *
     * @param {String} msg - message error
     * @param {Object} desc - error description
     * @api protected
     */
    protected onError(msg: string, desc?: any): void;
    /**
     * Called with parsed out a packets from the data stream.
     *
     * @param {Object} packet
     * @api protected
     */
    protected onPacket(packet: Packet): void;
    /**
     * Called with the encoded packet data.
     *
     * @param {String} data
     * @api protected
     */
    protected onData(data: any): void;
    /**
     * Called upon transport close.
     *
     * @api protected
     */
    protected onClose(): void;
    /**
     * Advertise framing support.
     */
    abstract get supportsFraming(): any;
    /**
     * The name of the transport.
     */
    abstract get name(): any;
    /**
     * Sends an array of packets.
     *
     * @param {Array} packets
     * @package
     */
    abstract send(packets: any): any;
    /**
     * Closes the transport.
     */
    abstract doClose(fn?: any): any;
}
export {};
