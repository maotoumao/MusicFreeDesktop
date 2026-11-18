# react-error-boundary

Reusable React [error boundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary) component. Supports all React renderers (including React DOM and React Native).

### If you like this project, 🎉 [become a sponsor](https://github.com/sponsors/bvaughn/) or ☕ [buy me a coffee](http://givebrian.coffee/)

## Getting started

```sh
# npm
npm install react-error-boundary

# pnpm
pnpm add react-error-boundary

# yarn
yarn add react-error-boundary
```

## API

### `ErrorBoundary` component
Wrap an `ErrorBoundary` component around other React components to "catch" errors and render a fallback UI. The component supports several ways to render a fallback (as shown below).

> **Note** `ErrorBoundary` is a _client_ component. You can only pass props to it that are serializeable or use it in files that have a `"use client";` directive.

#### `ErrorBoundary` with `fallback` prop
The simplest way to render a default "something went wrong" type of error message.
```js
"use client";

import { ErrorBoundary } from "react-error-boundary";

<ErrorBoundary fallback={<div>Something went wrong</div>}>
  <ExampleApplication />
</ErrorBoundary>
```
#### `ErrorBoundary` with `fallbackRender` prop
["Render prop"](https://react.dev/reference/react/Children#calling-a-render-prop-to-customize-rendering) function responsible for returning a fallback UI based on a thrown value.
```js
"use client";

import { ErrorBoundary } from "react-error-boundary";

function fallbackRender({ error, resetErrorBoundary }) {
  // Call resetErrorBoundary() to reset the error boundary and retry the render.

  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre style={{ color: "red" }}>{error.message}</pre>
    </div>
  );
}

<ErrorBoundary
  fallbackRender={fallbackRender}
  onReset={(details) => {
    // Reset the state of your app so the error doesn't happen again
  }}
>
  <ExampleApplication />
</ErrorBoundary>;
```
#### `ErrorBoundary` with `FallbackComponent` prop
React component responsible for returning a fallback UI based on a thrown value.
```js
"use client";

import { ErrorBoundary } from "react-error-boundary";

function Fallback({ error, resetErrorBoundary }) {
  // Call resetErrorBoundary() to reset the error boundary and retry the render.

  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre style={{ color: "red" }}>{error.message}</pre>
    </div>
  );
}

<ErrorBoundary
  FallbackComponent={Fallback}
  onReset={(details) => {
    // Reset the state of your app so the error doesn't happen again
  }}
>
  <ExampleApplication />
</ErrorBoundary>;
```

#### Logging errors with `onError`

```js
"use client";

import { ErrorBoundary } from "react-error-boundary";

const logError = (error: Error, info: { componentStack: string }) => {
  // Do something with the error, e.g. log to an external API
};

const ui = (
  <ErrorBoundary FallbackComponent={ErrorFallback} onError={logError}>
    <ExampleApplication />
  </ErrorBoundary>
);
```

### `useErrorBoundary` hook
Convenience hook for imperatively showing or dismissing error boundaries.

#### Show the nearest error boundary from an event handler

React only handles errors thrown during render or during component lifecycle methods (e.g. effects and did-mount/did-update). Errors thrown in event handlers, or after async code has run, will not be caught.

This hook can be used to pass those errors to the nearest error boundary:

```js
"use client";

import { useErrorBoundary } from "react-error-boundary";

function Example() {
  const { showBoundary } = useErrorBoundary();

  useEffect(() => {
    fetchGreeting(name).then(
      response => {
        // Set data in state and re-render
      },
      error => {
        // Show error boundary
        showBoundary(error);
      }
    );
  });

  // Render ...
}
```

#### Dismiss the nearest error boundary
A fallback component can use this hook to request the nearest error boundary retry the render that originally failed.

```js
"use client";

import { useErrorBoundary } from "react-error-boundary";

function ErrorFallback({ error }) {
  const { resetBoundary } = useErrorBoundary();

  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre style={{ color: "red" }}>{error.message}</pre>
      <button onClick={resetBoundary}>Try again</button>
    </div>
  );
}
```

### `withErrorBoundary` HOC
This package can also be used as a [higher-order component](https://legacy.reactjs.org/docs/higher-order-components.html) that accepts all of the same props as above:

```js
"use client";

import {withErrorBoundary} from 'react-error-boundary'

const ComponentWithErrorBoundary = withErrorBoundary(ExampleComponent, {
  fallback: <div>Something went wrong</div>,
  onError(error, info) {
    // Do something with the error
    // E.g. log to an error logging client here
  },
})

// Can be rendered as <ComponentWithErrorBoundary {...props} />
```

---

# FAQ
## `ErrorBoundary` cannot be used as a JSX component
This error can be caused by a version mismatch between [react](https://npmjs.com/package/react) and [@types/react](https://npmjs.com/package/@types/react). To fix this, ensure that both match exactly, e.g.:

If using NPM:
```json
{
  ...
  "overrides": {
    "@types/react": "17.0.60"
  },
  ...
}
```

If using Yarn:
```json
{
  ...
  "resolutions": {
    "@types/react": "17.0.60"
  },
  ...
}
```

---

[This blog post](https://kentcdodds.com/blog/use-react-error-boundary-to-handle-errors-in-react) shows more examples of how this package can be used, although it was written for the [version 3 API](https://github.com/bvaughn/react-error-boundary/releases/tag/v3.1.4).
