# @kidthales/pgmmv-types

[![CI](https://github.com/kidthales/pgmmv-types/actions/workflows/ci.yml/badge.svg)](https://github.com/kidthales/pgmmv-types/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@kidthales/pgmmv-types.svg)](https://www.npmjs.com/package/@kidthales/pgmmv-types)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js >= 22.2](https://img.shields.io/badge/node-%3E%3D22.2.0-brightgreen.svg)](./package.json)

Type-only TypeScript declaration package (`0` runtime JavaScript) for [Pixel Game Maker MV (PGMMV)](https://rpgmakerofficial.com/product/act/en/manual/01_01.html), covering the `Agtk`, `cc` (Cocos2d-JS), and `jsb` APIs.

---

## Installation

### npm (Public Registry)

Install as a development dependency from the public npm registry:

```bash
npm install --save-dev @kidthales/pgmmv-types
```

> [!NOTE]
> While `0.2.0-alpha.1` is published as a SemVer pre-release, install the pre-release dist-tag explicitly with `npm install --save-dev @kidthales/pgmmv-types@next` (or `@kidthales/pgmmv-types@0.2.0-alpha.1`).

### GitHub Packages (Alternative)

To install from GitHub Packages instead, map the `@kidthales` scope in `.npmrc`:

```ini
@kidthales:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install --save-dev @kidthales/pgmmv-types
```

---

## Usage

### TypeScript (`node16` / `nodenext` / `bundler`)

`@kidthales/pgmmv-types` ships pre-generated, `node16`-compliant `.d.ts` declarations in `dist/` exposed through `package.json` `"exports"`. It works cleanly with `moduleResolution` set to `"node16"`, `"nodenext"`, or `"bundler"`.

1. **Import module types** directly from `@kidthales/pgmmv-types`:

   ```ts
   // Include once in your project to type global `Agtk`, `cc`, and `jsb` namespaces
   import type {} from '@kidthales/pgmmv-types/pgmmv.d.ts';

   import type {
     AgtkAutoTileCallResult,
     AgtkParameter,
     AgtkPlugin,
     AgtkPluginInfoResult
   } from '@kidthales/pgmmv-types';

   const parameters: AgtkParameter[] = [
     {
       id: 1,
       name: 'Grid Size',
       type: 'Number',
       defaultValue: 16
     }
   ];

   export const plugin: AgtkPlugin<{ count: number }> = {
     setLocale() {},
     getInfo(category) {
       if (category === 'name') {
         return 'Example Plugin';
       }
       if (category === 'parameter') {
         return parameters;
       }
       return undefined;
     },
     initialize(data) {
       const ids: number[] = Agtk.objects.getIdList();
       Agtk.log('Initialized with ' + String(ids.length) + ' objects, count=' + String(data?.count ?? 0));
     },
     finalize() {},
     setParamValue() {},
     setInternal() {},
     call() {}
   };

   // Narrow `getInfo()` and `call()` return types using helper aliases
   const typedParams = plugin.getInfo('parameter') as AgtkPluginInfoResult<'parameter'>;
   const horzCount = plugin.call([], 'getHorzCount') as AgtkAutoTileCallResult<'getHorzCount'>;
   ```

2. **Global ambient types (`Agtk`, `cc`, `jsb`)**:

   Add `import type {} from '@kidthales/pgmmv-types/pgmmv.d.ts';` to a `.ts` / `.d.ts` file included in your `tsconfig.json`.

   > [!NOTE]
   > `pgmmv.d.ts` does not augment `Window` (for example `window.kt`). If your plugin attaches properties to `window`, declare your own `interface Window` augmentation in your project.

---

### Plain JavaScript (`// @ts-check` & ES5 PGMMV Plugins)

PGMMV executes plugins in an embedded ES5 JavaScript runtime. You can type-check plain ES5 `.js` plugin files using TypeScript's `// @ts-check` and JSDoc type imports without adding a build step:

```js
// @ts-check
/// <reference path="./node_modules/@kidthales/pgmmv-types/pgmmv.d.ts" />

(function () {
  /** @type {import('@kidthales/pgmmv-types').AgtkPlugin} */
  var plugin = {
    setLocale: function () {},

    getInfo: function (category) {
      switch (category) {
        case 'name':
          return 'My PGMMV Plugin';
        case 'parameter':
          return [];
        case 'internal':
          return null;
        default:
          break;
      }
    },

    initialize: function () {
      var sceneIds = Agtk.scenes.getIdList();
      Agtk.log('Loaded scenes: ' + String(sceneIds.length));
    },

    finalize: function () {},
    setParamValue: function () {},
    setInternal: function () {},
    call: function () {}
  };

  return plugin;
})();
```

> [!TIP]
> When running `tsc --noEmit` with `allowJs: true` and `lib: ["es2020", "dom"]` (or `"es5"`), TypeScript validates `Agtk`, `cc`, and `jsb` API usage via JSDoc while keeping your runtime output ES5-compatible. Legacy subpath imports under `@kidthales/pgmmv-types/lib/*` remain exported for backward compatibility.

---

## Package Exports

| Subpath | Target | Purpose |
| :--- | :--- | :--- |
| `@kidthales/pgmmv-types` | `./dist/index.d.ts` | Root TypeScript declarations (`Agtk`, `cc`, `jsb`, `AgtkPlugin`, `AgtkPluginInfoMap`, `AgtkPluginInfoResult`, `AgtkAutoTile*`, `AgtkParameter`, etc.) |
| `@kidthales/pgmmv-types/pgmmv.d.ts` | `./pgmmv.d.ts` | Global ambient `Agtk`, `cc`, and `jsb` declarations |
| `@kidthales/pgmmv-types/lib/*` | `./lib/*` | Direct source declaration subpaths (backward compatibility) |
| `@kidthales/pgmmv-types/package.json` | `./package.json` | Package manifest |

---

## Development & Verification

Requires **Node.js `>=22.2.0`**.

```bash
npm install
npm run generate     # Emit node16-clean .d.ts files into dist/ and validate node16 resolution
npm run check:types  # Type-check bundler and node16 consumer fixtures
npm run lint         # Run root tsc --noEmit, check:types, and tools/lint.mjs
npm test             # Run npm run lint and node --test (tests/types.test.mjs, tests/tools.test.mjs, tests/ci.test.mjs)
npm run ci:local     # Run the full local Gate 0-4 CI suite via pwsh ./scripts/ci-local.ps1
```

---

## References & License

- [Changelog](./CHANGELOG.md)
- [Plug-in Specifications & Information](https://rpgmakerofficial.com/product/act/en/manual/Plug-in_Spec_en.pdf)
- [Cocos2d API Reference](https://docs.cocos2d-x.org/api-ref/js/v3x/index.html)
- [MIT License](./LICENSE)
