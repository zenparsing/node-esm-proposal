# A Modest Proposal for ESM in Node

## Assumptions and Principles:

-	We assume the current state of the ES module specification. Specifically, we assume that named imports from CommonJS modules cannot be supported.
-	The module system should remain as close as possible to Node’s existing module system.
-	Developers of portable (node/web) and non-portable (node-only) programs should be given equal priority.
-	We should attempt, when possible, to pave the cowpaths established by the JavaScript community.
-	A file with the extension `.mjs` is unambiguously an ESM module.
-	A file with the extension `.js` is ambiguous: it might be an ESM module, a CommonJS module, or a script.

## Supporting Changes

### Node CLI

-	A `--module` CLI flag forces Node to execute the entry program as an ESM module.
- Otherwise, if the entry program has an `.mjs` extension, then Node executes the file as an ESM module.
- Otherwise, Node executes the file as a CJS module.

### Module environment

- The global environment for ESM modules is unchanged.
- The `import.meta` object contains the following properties:
  - `url`: A URL string representing the location of the module.
  - `filename`: The full path of the currently executing module.
  - `dirname`: The directory name of the currently executing module.
  - `require`: Allows loading CJS modules.

### Module Resolution

- There is no change to `node_modules` resolution for bare specifiers.
- File extensions are searched as in the current implementation, where `.mjs` is preferred over `.js`.
- Both `.js` and `.mjs` files are loaded as ESM modules.
- If the module specifier resolves to a folder, then
  - If there is a `package.json` file and that file contains a "module" key, then the package entry point is loaded from that path.
  - Otherwise, the package entry point is loaded by searching for an `index` file.

## FAQ

### As a CJS package author, how do I support ESM consumers?

You can create a simple ESM entry point at the root of your project:

```js
// Using a default export
export default import.meta.require('./');
// Named exports
export const { exportA, exportB } = import.meta.require('./');
```

If you use `package.json::main`, then you'll add a "module" key pointing to this file.

If you use `index.js` as your entry point, then you can name this file `index.mjs`.

### As an ESM author, how do I support CJS consumers?

You can install the "esm" package to convert ESM modules to CJS modules at runtime:

```js
// Point "package.json::main" here
module.exports = require('esm')(module)('./');
```

Or you can use Babel to convert ESM to CJS at publish time.

### How do I support deep package imports for both ESM and CJS consumers?

You can have two files side-by-side: one named with a `.js` extension and one named with an `.mjs` extension. When imported, the `.mjs` file will be found. When "required", the `.js` file will be found.

### How do I use a CJS package from an ESM module?

```js
import.meta.require('<cjs_module>');
```

You should also create a PR against the project as well, so that you and others can import it directly.

### How do I use an ESM package from a CJS module?

```js
// Dynamic import
import('<esm_module>').then(esm => {});
```

### How do I import from a folder?

You can use the `package.json::module` field, or an `index.js` or `index.mjs` file.
