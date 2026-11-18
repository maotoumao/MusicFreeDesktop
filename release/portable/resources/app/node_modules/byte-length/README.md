<h1 align="center">
  <!-- Logo -->
  <br/>
  Byte-Length
	<br/>

  <!-- Stability -->
  <a href="https://nodejs.org/api/documentation.html#documentation_stability_index">
    <img src="https://img.shields.io/badge/stability-stable-brightgreen.svg" alt="API Stability"/>
  </a>
  <!-- TypeScript -->
  <a href="http://typescriptlang.org">
    <img src="https://img.shields.io/badge/%3C%2F%3E-typescript-blue.svg" alt="TypeScript"/>
  </a>
  <!-- Prettier -->
  <a href="https://github.com/prettier/prettier">
    <img src="https://img.shields.io/badge/styled_with-prettier-ff69b4.svg" alt="Styled with prettier"/>
  </a>
  <!-- Travis build -->
  <a href="https://travis-ci.org/DylanPiercey/byte-length">
  <img src="https://img.shields.io/travis/DylanPiercey/byte-length.svg" alt="Build status"/>
  </a>
  <!-- Coveralls coverage -->
  <a href="https://coveralls.io/github/DylanPiercey/byte-length">
    <img src="https://img.shields.io/coveralls/DylanPiercey/byte-length.svg" alt="Test Coverage"/>
  </a>
  <!-- NPM version -->
  <a href="https://npmjs.org/package/byte-length">
    <img src="https://img.shields.io/npm/v/byte-length.svg" alt="NPM Version"/>
  </a>
  <!-- Downloads -->
  <a href="https://npmjs.org/package/byte-length">
    <img src="https://img.shields.io/npm/dm/byte-length.svg" alt="Downloads"/>
  </a>
  <!-- Size -->
  <a href="https://npmjs.org/package/byte-length">
    <img src="https://img.shields.io/badge/size-422b-green.svg" alt="Browser Bundle Size"/>
  </a>
</h1>

Calculate the real byte length of any string.

# Why
In node many will use `Buffer.byteLength`, however including the entire buffer shim in the browser just for getting the byte length of a string is not very conservative.

# Installation

```console
npm install byte-length
```

# Example

```javascript
import { byteLength } from "byte-length";

byteLength("hello"); //-> 5
byteLength("😀"); //-> 4
byteLength("ｆｕｌｌｗｉｄｔｈ　ｃｈａｒａｃｔｅｒｓ"); //-> 60
```

### Contributions

* Use `npm test` to run tests.

Please feel free to create a PR!
