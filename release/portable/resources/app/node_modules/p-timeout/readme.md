# p-timeout

> Timeout a promise after a specified amount of time

## Install

```
$ npm install p-timeout
```

## Usage

```js
import {setTimeout} from 'timers/promises';
import pTimeout from 'p-timeout';

const delayedPromise = setTimeout(200);

await pTimeout(delayedPromise, 50);
//=> [TimeoutError: Promise timed out after 50 milliseconds]
```

## API

### pTimeout(input, milliseconds, message?, options?)
### pTimeout(input, milliseconds, fallback?, options?)

Returns a decorated `input` that times out after `milliseconds` time. It has a `.clear()` method that clears the timeout.

If you pass in a cancelable promise, specifically a promise with a `.cancel()` method, that method will be called when the `pTimeout` promise times out.

#### input

Type: `Promise`

Promise to decorate.

#### milliseconds

Type: `number`

Milliseconds before timing out.

Passing `Infinity` will cause it to never time out.

#### message

Type: `string | Error`\
Default: `'Promise timed out after 50 milliseconds'`

Specify a custom error message or error.

If you do a custom error, it's recommended to sub-class `pTimeout.TimeoutError`.

#### fallback

Type: `Function`

Do something other than rejecting with an error on timeout.

You could for example retry:

```js
import {setTimeout} from 'timers/promises';
import pTimeout from 'p-timeout';

const delayedPromise = () => setTimeout(200);

await pTimeout(delayedPromise(), 50, () => {
	return pTimeout(delayedPromise(), 300);
});
```

#### options

Type: `object`

##### customTimers

Type: `object` with function properties `setTimeout` and `clearTimeout`

Custom implementations for the `setTimeout` and `clearTimeout` functions.

Useful for testing purposes, in particular to work around [`sinon.useFakeTimers()`](https://sinonjs.org/releases/latest/fake-timers/).

Example:

```js
import {setTimeout} from 'timers/promises';
import pTimeout from 'p-timeout';

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

#### signal

Type: [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)

You can abort the promise using [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController).

*Requires Node.js 16 or later.*

```js
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

### TimeoutError

Exposed for instance checking and sub-classing.

## Related

- [delay](https://github.com/sindresorhus/delay) - Delay a promise a specified amount of time
- [p-min-delay](https://github.com/sindresorhus/p-min-delay) - Delay a promise a minimum amount of time
- [p-retry](https://github.com/sindresorhus/p-retry) - Retry a promise-returning function
- [More…](https://github.com/sindresorhus/promise-fun)
