/* eslint-disable import/export */

export class TimeoutError extends Error {
	readonly name: 'TimeoutError';
	constructor(message?: string);
}

export interface ClearablePromise<T> extends Promise<T>{
	/**
	Clear the timeout.
	*/
	clear: () => void;
}

export type Options = {
	/**
	Custom implementations for the `setTimeout` and `clearTimeout` functions.

	Useful for testing purposes, in particular to work around [`sinon.useFakeTimers()`](https://sinonjs.org/releases/latest/fake-timers/).

	@example
	```
	import pTimeout from 'p-timeout';
	import sinon from 'sinon';

	const originalSetTimeout = setTimeout;
	const originalClearTimeout = clearTimeout;

	sinon.useFakeTimers();

	// Use `pTimeout` without being affected by `sinon.useFakeTimers()`:
	await pTimeout(doSomething(), 2000, undefined, {
		customTimers: {
			setTimeout: originalSetTimeout,
			clearTimeout: originalClearTimeout
		}
	});
	```
	*/
	readonly customTimers?: {
		setTimeout: typeof global.setTimeout;
		clearTimeout: typeof global.clearTimeout;
	};

	/**
	You can abort the promise using [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController).

	_Requires Node.js 16 or later._

	@example
	```
	import pTimeout from 'p-timeout';
	import delay from 'delay';

	const delayedPromise = delay(3000);

	const abortController = new AbortController();

	setTimeout(() => {
		abortController.abort();
	}, 100);

	await pTimeout(delayedPromise, 2000, undefined, {
		signal: abortController.signal
	});
	```
	*/
	signal?: globalThis.AbortSignal;
};

/**
Timeout a promise after a specified amount of time.

If you pass in a cancelable promise, specifically a promise with a `.cancel()` method, that method will be called when the `pTimeout` promise times out.

@param input - Promise to decorate.
@param milliseconds - Milliseconds before timing out.
@param message - Specify a custom error message or error. If you do a custom error, it's recommended to sub-class `pTimeout.TimeoutError`. Default: `'Promise timed out after 50 milliseconds'`.
@returns A decorated `input` that times out after `milliseconds` time. It has a `.clear()` method that clears the timeout.

@example
```
import {setTimeout} from 'timers/promises';
import pTimeout from 'p-timeout';

const delayedPromise = setTimeout(200);

await pTimeout(delayedPromise, 50);
//=> [TimeoutError: Promise timed out after 50 milliseconds]
```
*/
export default function pTimeout<ValueType>(
	input: PromiseLike<ValueType>,
	milliseconds: number,
	message?: string | Error,
	options?: Options
): ClearablePromise<ValueType>;

/**
Timeout a promise after a specified amount of time.

If you pass in a cancelable promise, specifically a promise with a `.cancel()` method, that method will be called when the `pTimeout` promise times out.

@param input - Promise to decorate.
@param milliseconds - Milliseconds before timing out. Passing `Infinity` will cause it to never time out.
@param fallback - Do something other than rejecting with an error on timeout. You could for example retry.
@returns A decorated `input` that times out after `milliseconds` time. It has a `.clear()` method that clears the timeout.

@example
```
import {setTimeout} from 'timers/promises';
import pTimeout from 'p-timeout';

const delayedPromise = () => setTimeout(200);

await pTimeout(delayedPromise(), 50, () => {
	return pTimeout(delayedPromise(), 300);
});
```
*/
export default function pTimeout<ValueType, ReturnType>(
	input: PromiseLike<ValueType>,
	milliseconds: number,
	fallback: () => ReturnType | Promise<ReturnType>,
	options?: Options
): ClearablePromise<ValueType | ReturnType>;
