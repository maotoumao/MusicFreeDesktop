export const defaultMessages = 'End-Of-Stream';
/**
 * Thrown on read operation of the end of file or stream has been reached
 */
export class EndOfStreamError extends Error {
    constructor() {
        super(defaultMessages);
    }
}
