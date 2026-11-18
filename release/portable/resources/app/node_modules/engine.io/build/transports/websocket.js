"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocket = void 0;
const transport_1 = require("../transport");
const debug_1 = require("debug");
const debug = (0, debug_1.default)("engine:ws");
class WebSocket extends transport_1.Transport {
    /**
     * WebSocket transport
     *
     * @param {http.IncomingMessage}
     * @api public
     */
    constructor(req) {
        super(req);
        this.socket = req.websocket;
        this.socket.on("message", (data, isBinary) => {
            const message = isBinary ? data : data.toString();
            debug('received "%s"', message);
            super.onData(message);
        });
        this.socket.once("close", this.onClose.bind(this));
        this.socket.on("error", this.onError.bind(this));
        this.writable = true;
        this.perMessageDeflate = null;
    }
    /**
     * Transport name
     *
     * @api public
     */
    get name() {
        return "websocket";
    }
    /**
     * Advertise upgrade support.
     *
     * @api public
     */
    get handlesUpgrades() {
        return true;
    }
    /**
     * Advertise framing support.
     *
     * @api public
     */
    get supportsFraming() {
        return true;
    }
    /**
     * Writes a packet payload.
     *
     * @param {Array} packets
     * @api private
     */
    send(packets) {
        this.writable = false;
        for (let i = 0; i < packets.length; i++) {
            const packet = packets[i];
            const isLast = i + 1 === packets.length;
            // always creates a new object since ws modifies it
            const opts = {};
            if (packet.options) {
                opts.compress = packet.options.compress;
            }
            const onSent = (err) => {
                if (err) {
                    return this.onError("write error", err.stack);
                }
                else if (isLast) {
                    this.writable = true;
                    this.emit("drain");
                }
            };
            const send = (data) => {
                if (this.perMessageDeflate) {
                    const len = "string" === typeof data ? Buffer.byteLength(data) : data.length;
                    if (len < this.perMessageDeflate.threshold) {
                        opts.compress = false;
                    }
                }
                debug('writing "%s"', data);
                this.socket.send(data, opts, onSent);
            };
            if (packet.options && typeof packet.options.wsPreEncoded === "string") {
                send(packet.options.wsPreEncoded);
            }
            else if (this._canSendPreEncodedFrame(packet)) {
                // the WebSocket frame was computed with WebSocket.Sender.frame()
                // see https://github.com/websockets/ws/issues/617#issuecomment-283002469
                this.socket._sender.sendFrame(packet.options.wsPreEncodedFrame, onSent);
            }
            else {
                this.parser.encodePacket(packet, this.supportsBinary, send);
            }
        }
    }
    /**
     * Whether the encoding of the WebSocket frame can be skipped.
     * @param packet
     * @private
     */
    _canSendPreEncodedFrame(packet) {
        var _a, _b, _c;
        return (!this.perMessageDeflate &&
            typeof ((_b = (_a = this.socket) === null || _a === void 0 ? void 0 : _a._sender) === null || _b === void 0 ? void 0 : _b.sendFrame) === "function" &&
            ((_c = packet.options) === null || _c === void 0 ? void 0 : _c.wsPreEncodedFrame) !== undefined);
    }
    /**
     * Closes the transport.
     *
     * @api private
     */
    doClose(fn) {
        debug("closing");
        this.socket.close();
        fn && fn();
    }
}
exports.WebSocket = WebSocket;
