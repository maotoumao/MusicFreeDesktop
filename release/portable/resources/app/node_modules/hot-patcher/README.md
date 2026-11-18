# Hot-Patcher
> Hot method patching framework for handling environmental method differences

![Build status](https://github.com/perry-mitchell/hot-patcher/actions/workflows/test.yml/badge.svg) [![npm version](https://badge.fury.io/js/hot-patcher.svg)](https://www.npmjs.com/package/hot-patcher)

## About

Hot-Patcher provides a simple API to manage patched methods. I found while writing [Buttercup](https://buttercup.pw) that managing overwritten methods between environments (Node/Browser/React-Native) was becoming cumbersome, and having a single _agreed-upon_ method of doing so was the best way to go.

## Installation

Install Hot-Patcher from [npm](https://www.npmjs.com/package/hot-patcher):

```shell
npm install hot-patcher --save
```

**NB:** This is an ESM library.

## Usage

Hot-Patcher is a class and can simply be instantiated:

```typescript
import { HotPatcher } from "hot-patcher";

const hp = new HotPatcher();
```

Hot-Patcher is designed to be used with patchable tools:

```typescript
import { HotPatcher } from "hot-patcher";

export class MyHelper {
    public patcher: HotPatcher;

    constructor() {
        this.patcher = new HotPatcher();
    }

    increment(arg: number): number {
        return this.patcher.patchInline<number>("increment", someArg => {
            return someArg + 1;
        }, arg);
    }
}
```

You can then patch methods when required:

```typescript
import { MyHelper } from "./MyHelper.js";

export function getHelper() {
    const helper = new MyHelper();
    helper.patch("increment", (val: number) => val + 2);
    return helper;
}
```

Patched methods can easily be fetched later:

```typescript
import { getSharedPatcher } from "./patching.js";

const randomString = getSharedPatcher().get("randomString");
randomString(5); // Generates a random string

// Or, execute the method directly:
getSharedPatcher().execute("randomString", 5) // Generates a random string
```

You can check if a method is patched by using `isPatched`: `patcher.isPatched("some method")`.

### Inline patching and execution

Ideally you could wrap function implementation with a patch call, executing it on demand:

```typescript
function add(a: number, b: number): number {
    return patcher.patchInline("add", (a, b) => a + b, a, b);
}

patcher.isPatched("add"); // false
add(1, 2); // 3
patcher.isPatched("add"); // true
// calling add() multiple times will call the patched method without "re-patching" it
// over and over again..
```

### Plugins - Chaining/Sequencing functions

You can use Hot-Patcher to create sequences of functions:

```typescript
patcher.plugin("increment", x => x * 2, x => x * 2);

patcher.execute("increment", 2); // 8
```

Which is basically syntactic sugar for a regular `patch()` call: 

```typescript
patcher
    .patch("increment", x => x * 2, { chain: true })
    .patch("increment", x => x * 2, { chain: true });

patcher.execute("increment", 2); // 8
```

Executing a regular `patch()` without `chain: true` will overwrite all chained methods with the new method. 

Calling `patch()` with `chain: true` when a method already exists will simply add the new method after the existing:

```typescript
patcher
    .patch("increment", x => x * 2, { chain: false }) // or simply without `chain` specified
    .patch("increment", x => x * 2, { chain: true });

patcher.execute("increment", 2); // still 8
```


### Restoring methods
Methods can be restored to their _originally patched function_ by calling the `restore` method:

```typescript
const methodA = () => {};
const methodB = () => {};

patcher
    // methodA is now the current (and original)
    .patch("someMethod", methodA)
    // methodB is now the current
    .patch("someMethod", methodB);

// Restore "someMethod" to methodA (original)
patcher.restore("someMethod");
```

## Use Sparingly

The intention of Hot-Patcher is not to push every method into a patching instance, but to provide a common API for specific methods which _require_ patching in some specific environments or in situations where users/consumers are expected to provide their own custom implementations.
