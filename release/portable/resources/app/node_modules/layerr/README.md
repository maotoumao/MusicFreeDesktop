# Layerr
> Errors, with.. layers..

A NodeJS and Web `Error` wrapping utility, based heavily on [VError](https://github.com/joyent/node-verror), but without all the extras and dependencies on Node core utilities. Written in Typescript, compiled to JavaScript and suitable for bundling in the browser.

Uses no dependencies, minifies well and is a great way to wrap errors as they propagate through complex applications (such as Express services, for instance).

_Layerr is an ESM library, and as such you need a compatible environment in which to install and use it._

## Installation

Install by running: `npm install layerr`.

## Usage

Use it as a regular error:

```javascript
const { Layerr } = require("layerr");

throw new Layerr("Test error");
```

Or use it to wrap errors:

```javascript
doSomething().catch(err => {
    throw new Layerr(err, "Failed doing something");
});
```

Layerr's can have info attached:

```javascript
const { Layerr } = require("layerr");

function somethingElse() {
    throw new Layerr({
        info: {
            code: 123
        }
    }, "Problem");
}

somethingElse().catch((err: Layerr) => {
    const { code } = Layerr.info(err);
    // code === 123
});
```
