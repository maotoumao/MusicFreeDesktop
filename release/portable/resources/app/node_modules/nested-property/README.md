![npm](https://img.shields.io/npm/dw/nested-property) 
![Actively Maintained](https://img.shields.io/badge/Maintenance%20Level-Actively%20Maintained-green.svg)

# Nested property

Traverse a deeply nested JS data structure to get, set values, or test if values are part of the data structure.
Nested property offers a simple syntax to define a path to access a value with.

For instance:

```js
const data = { 
  a: {
    b: [
      10,
      20
    ]
  }
 };

nestedProperty.get(data, "a.b.1"); // returns 20, or sdata.a.b[1]
```

The syntax also supports array wildcards to access all items within an array:

```js
const array = [
  { ssn: "123-456-7890", name: "alice" },
  { ssn: "234-567-8901", name: "bob" },
  { ssn: "456-789-0123", name: "charlie" }
]

nestedProperty.set(array, "+.ssn", "<redacted>"); // sets all `ssn` values to <redacted>
```


## Install

```bash
npm install nested-property
```

## Use

Require nested-property:

```bash
var nestedProperty = require("nested-property");
```

### nestedProperty.get(data, "path")

__You can get a nested property from an object:__

```js
var object = {
  a: {
    b: {
      c: {
        d: 5
      }
    }
  }
};

nestedProperty.get(object, "a"); // returns object.a
nestedProperty.get(object, "a.b.c"); // returns object.a.b.c
nestedProperty.get(object, "a.b.c.d"); // returns 5
nestedProperty.get(object, "a.d.c"); // returns undefined
nestedProperty.get(object); // returns object
nestedProperty.get(null); // returns null
```

It also works through arrays:

```js
var array = [{
  a: {
    b: [0, 1]
  }
  }];

nestedProperty.get(array, "0"); // returns array[0]
nestedProperty.get(array, "0.a.b"); // returns array[0].a.b
nestedProperty.get(array, "0.a.b.0"); // returns 0
nestedProperty.get(array, "1.a.b.c"); // returns undefined
```

You may also use wildcards to access multiple values:

```js
var array = [
  { a: 0, b: 1, c: 2 },
  { a: 10, b: 11, c: 12 },
  { a: 20, b: 21, c: 22 }
]

nestedProperty.get(array, "+.b"); // returns [1, 11, 21]
```

### nestedProperty.set(data, "path", value)

__You can set a nested property on an object:__

```js
var object = {
  a: {
    b: {
      c: {
        d: 5
      }
    }
  }
};

nestedProperty.set(object, "a", 1); // object.a == 1
nestedProperty.set(object, "a.b.c", 1337); // object.a.b.c == 1337
nestedProperty.set(object, "e.f.g", 1); // object.e.f.g == 1, it creates the missing objects!
nestedProperty.set(object); // returns object
nestedProperty.set(null); // returns null
```

You can also set a nested property through arrays:

```js
var array = [
 {
   a: [0, 1]
 }
];

nestedProperty.set(array, "0.a.0", 10); // array[0].a[0] == 10
nestedProperty.set(array, "0.b.c", 1337); // array[0].b.c == 1337
```


You may also use wildcards to set multiple values:

```js
var array = [
  { a: 0, b: 1, c: 2 },
  { a: 10, b: 11, c: 12 },
  { a: 20, b: 21, c: 22 }
]

nestedProperty.set(array, "+.b", 0); // array[0].b === 0, array[1].b === 0, array[2].b === 0 
```

### nestedProperty.has(data, "path")

__You can also test if a data structure has a nested property:__

```js
var array = [
 {
   a: [0, 1]
 }
];

nestedProperty.has(array, "0.a"); // true
nestedProperty.has(array, "0.a.1"); // true
nestedProperty.has(array, "0.a.2"); // false
nestedProperty.has(array, "1.a.0"); // false
```

The example shows that it works through array, but of course, plain objects are fine too.

If it must be an "own" property (i.e. not in the prototype chain) you can use the own option:

```js
function DataStructure() {}
DataStructure.prototype.prop = true;

var obj = new DataStructure();

nestedProperty.has(obj, "prop", { own: true }); // false
nestedProperty.has(obj, "prop"); // true
```

Alternatively, you can use the hasOwn function:

```js
var obj = Object.create({ prop: true });

nestedProperty.hasOwn(obj, "prop"); // false
```

Just like other methods, you may also use array wildcards. For instance, testing if any item in an array has a given property:

```js
var array = [
  { a: 0, b: 1, c: 2 },
  { a: 10, b: 11, c: 12, d: 13 },
  { a: 20, b: 21, c: 22 }
]

nestedProperty.has(array, "+.d"); // returns true, since array[1].d exists
```

### nestedProperty.isIn(data, "path", value)

__And finally, you can test if an object is on the path to a nested property:__

```js
var obj = {
    nested: [
        {
            property: true
        }
    ]
};

nestedProperty.isIn(obj, "nested.0.property", obj); // true
nestedProperty.isIn(obj, "nested.0.property", obj.nested); // true
nestedProperty.isIn(obj, "nested.0.property", obj.nested[0]); // true

nestedProperty.isIn(obj, "nested.0.property", {}); // false
```

The path doesn't have to be completely valid to return true, as long as the value exists within the valid portion.

```js
nestedProperty.isIn(obj, "nested.0.property.foo.bar.path", obj.nested[0]); // true
```

Unless the `validPath` option is set to `true`, in this case the full path needs to be valid:

```js
nestedProperty.isIn(obj, "nested.0.property.foo.bar.path", obj.nested[0], { validPath: true }); // false
```

Note that if instead of an object you give it the value of the nested property, it'll return true:

```js
nestedProperty.isIn(obj, "nested.0.property", obj.nested[0].property); // true
nestedProperty.isIn(obj, "nested.0.property", true); // true
```

### nestedProperty.ObjectPrototypeMutationError

__Note that it's not permitted to mutate Object.prototype:__

```
nestedProperty.set({}, '__protot__.a', 1); // throws nestedProperty.ObjectPrototypeMutationError
```

# LICENSE

MIT
