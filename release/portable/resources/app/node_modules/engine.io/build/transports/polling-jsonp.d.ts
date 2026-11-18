import { Polling } from "./polling";
export declare class JSONP extends Polling {
    private readonly head;
    private readonly foot;
    /**
     * JSON-P polling transport.
     *
     * @api public
     */
    constructor(req: any);
    /**
     * Handles incoming data.
     * Due to a bug in \n handling by browsers, we expect a escaped string.
     *
     * @api private
     */
    onData(data: any): void;
    /**
     * Performs the write.
     *
     * @api private
     */
    doWrite(data: any, options: any, callback: any): void;
}
