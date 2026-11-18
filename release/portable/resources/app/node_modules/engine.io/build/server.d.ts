/// <reference types="node" />
import { EventEmitter } from "events";
import type { IncomingMessage, Server as HttpServer, ServerResponse } from "http";
import type { CookieSerializeOptions } from "cookie";
import type { CorsOptions, CorsOptionsDelegate } from "cors";
import type { Duplex } from "stream";
declare type Transport = "polling" | "websocket";
export interface AttachOptions {
    /**
     * name of the path to capture
     * @default "/engine.io"
     */
    path?: string;
    /**
     * destroy unhandled upgrade requests
     * @default true
     */
    destroyUpgrade?: boolean;
    /**
     * milliseconds after which unhandled requests are ended
     * @default 1000
     */
    destroyUpgradeTimeout?: number;
    /**
     * Whether we should add a trailing slash to the request path.
     * @default true
     */
    addTrailingSlash?: boolean;
}
export interface ServerOptions {
    /**
     * how many ms without a pong packet to consider the connection closed
     * @default 20000
     */
    pingTimeout?: number;
    /**
     * how many ms before sending a new ping packet
     * @default 25000
     */
    pingInterval?: number;
    /**
     * how many ms before an uncompleted transport upgrade is cancelled
     * @default 10000
     */
    upgradeTimeout?: number;
    /**
     * how many bytes or characters a message can be, before closing the session (to avoid DoS).
     * @default 1e5 (100 KB)
     */
    maxHttpBufferSize?: number;
    /**
     * A function that receives a given handshake or upgrade request as its first parameter,
     * and can decide whether to continue or not. The second argument is a function that needs
     * to be called with the decided information: fn(err, success), where success is a boolean
     * value where false means that the request is rejected, and err is an error code.
     */
    allowRequest?: (req: IncomingMessage, fn: (err: string | null | undefined, success: boolean) => void) => void;
    /**
     * The low-level transports that are enabled. WebTransport is disabled by default and must be manually enabled:
     *
     * @example
     * new Server({
     *   transports: ["polling", "websocket", "webtransport"]
     * });
     *
     * @default ["polling", "websocket"]
     */
    transports?: Transport[];
    /**
     * whether to allow transport upgrades
     * @default true
     */
    allowUpgrades?: boolean;
    /**
     * parameters of the WebSocket permessage-deflate extension (see ws module api docs). Set to false to disable.
     * @default false
     */
    perMessageDeflate?: boolean | object;
    /**
     * parameters of the http compression for the polling transports (see zlib api docs). Set to false to disable.
     * @default true
     */
    httpCompression?: boolean | object;
    /**
     * what WebSocket server implementation to use. Specified module must
     * conform to the ws interface (see ws module api docs).
     * An alternative c++ addon is also available by installing eiows module.
     *
     * @default `require("ws").Server`
     */
    wsEngine?: any;
    /**
     * an optional packet which will be concatenated to the handshake packet emitted by Engine.IO.
     */
    initialPacket?: any;
    /**
     * configuration of the cookie that contains the client sid to send as part of handshake response headers. This cookie
     * might be used for sticky-session. Defaults to not sending any cookie.
     * @default false
     */
    cookie?: (CookieSerializeOptions & {
        name: string;
    }) | boolean;
    /**
     * the options that will be forwarded to the cors module
     */
    cors?: CorsOptions | CorsOptionsDelegate;
    /**
     * whether to enable compatibility with Socket.IO v2 clients
     * @default false
     */
    allowEIO3?: boolean;
}
/**
 * An Express-compatible middleware.
 *
 * Middleware functions are functions that have access to the request object (req), the response object (res), and the
 * next middleware function in the application’s request-response cycle.
 *
 * @see https://expressjs.com/en/guide/using-middleware.html
 */
declare type Middleware = (req: IncomingMessage, res: ServerResponse, next: (err?: any) => void) => void;
export declare abstract class BaseServer extends EventEmitter {
    opts: ServerOptions;
    protected clients: any;
    clientsCount: number;
    protected middlewares: Middleware[];
    /**
     * Server constructor.
     *
     * @param {Object} opts - options
     * @api public
     */
    constructor(opts?: ServerOptions);
    protected abstract init(): any;
    /**
     * Compute the pathname of the requests that are handled by the server
     * @param options
     * @protected
     */
    protected _computePath(options: AttachOptions): string;
    /**
     * Returns a list of available transports for upgrade given a certain transport.
     *
     * @return {Array}
     * @api public
     */
    upgrades(transport: any): any;
    /**
     * Verifies a request.
     *
     * @param {http.IncomingMessage}
     * @return {Boolean} whether the request is valid
     * @api private
     */
    protected verify(req: any, upgrade: any, fn: any): any;
    /**
     * Adds a new middleware.
     *
     * @example
     * import helmet from "helmet";
     *
     * engine.use(helmet());
     *
     * @param fn
     */
    use(fn: any): void;
    /**
     * Apply the middlewares to the request.
     *
     * @param req
     * @param res
     * @param callback
     * @protected
     */
    protected _applyMiddlewares(req: IncomingMessage, res: ServerResponse, callback: (err?: any) => void): void;
    /**
     * Closes all clients.
     *
     * @api public
     */
    close(): this;
    protected abstract cleanup(): any;
    /**
     * generate a socket id.
     * Overwrite this method to generate your custom socket id
     *
     * @param {Object} request object
     * @api public
     */
    generateId(req: any): any;
    /**
     * Handshakes a new client.
     *
     * @param {String} transport name
     * @param {Object} request object
     * @param {Function} closeConnection
     *
     * @api protected
     */
    protected handshake(transportName: any, req: any, closeConnection: any): Promise<any>;
    onWebTransportSession(session: any): Promise<any>;
    protected abstract createTransport(transportName: any, req: any): any;
    /**
     * Protocol errors mappings.
     */
    static errors: {
        UNKNOWN_TRANSPORT: number;
        UNKNOWN_SID: number;
        BAD_HANDSHAKE_METHOD: number;
        BAD_REQUEST: number;
        FORBIDDEN: number;
        UNSUPPORTED_PROTOCOL_VERSION: number;
    };
    static errorMessages: {
        0: string;
        1: string;
        2: string;
        3: string;
        4: string;
        5: string;
    };
}
export declare class Server extends BaseServer {
    httpServer?: HttpServer;
    private ws;
    /**
     * Initialize websocket server
     *
     * @api protected
     */
    protected init(): void;
    protected cleanup(): void;
    /**
     * Prepares a request by processing the query string.
     *
     * @api private
     */
    private prepare;
    protected createTransport(transportName: any, req: any): any;
    /**
     * Handles an Engine.IO HTTP request.
     *
     * @param {IncomingMessage} req
     * @param {ServerResponse} res
     * @api public
     */
    handleRequest(req: IncomingMessage, res: ServerResponse): void;
    /**
     * Handles an Engine.IO HTTP Upgrade.
     *
     * @api public
     */
    handleUpgrade(req: IncomingMessage, socket: Duplex, upgradeHead: Buffer): void;
    /**
     * Called upon a ws.io connection.
     *
     * @param {ws.Socket} websocket
     * @api private
     */
    private onWebSocket;
    /**
     * Captures upgrade requests for a http.Server.
     *
     * @param {http.Server} server
     * @param {Object} options
     * @api public
     */
    attach(server: HttpServer, options?: AttachOptions): void;
}
export {};
