# Changelog

All notable changes to `@kidthales/pgmmv-types` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0-alpha.1] - 2026-11-15

Pre-release preparing `@kidthales/pgmmv-types` for public npm registry publication with generated `node16`-clean `dist/` declarations, AutoTile and Database declaration updates, and a zero-bloat TypeScript 7 toolchain.

### Breaking Changes

- **`AgtkPlugin.getInfo` now returns a union instead of a conditional type (`#70`, `#77`)**:
  - Signature changed from generic conditional `<C extends AgtkPluginInfoCategory>(category: C) => C extends ...` to `(category: AgtkPluginInfoCategoryValue) => AgtkPluginInfoMap<I>[AgtkPluginInfoCategory] | undefined`.
  - Returning a union allows TypeScript and plain-JS `// @ts-check` plugin implementations to implement `getInfo` ergonomically without failing conditional-type assignability checks.
  - **Migration**: Callers inspecting a specific category's return value must narrow the union or use the new `AgtkPluginInfoResult<C, I>` (or `AgtkPluginInfoMap<I>[C]`) helper type:
    ```ts
    import type { AgtkPlugin, AgtkPluginInfoResult } from '@kidthales/pgmmv-types';

    declare const plugin: AgtkPlugin<{ count: number }>;

    // Before (0.1.x):
    // const params = plugin.getInfo(AgtkPluginInfoCategory.Parameter); // AgtkParameter[]

    // After (0.2.0-alpha.1):
    const rawParams = plugin.getInfo('parameter');
    const params = rawParams as AgtkPluginInfoResult<'parameter'>;
    const internal = plugin.getInfo('internal') as AgtkPluginInfoResult<'internal', { count: number }>;
    ```
- **`AgtkPlugin.id` is now optional (`readonly id?: number`) (`#70`)**:
  - PGMMV assigns `plugin.id` at runtime when initializing a plugin. Object literals implementing `AgtkPlugin` no longer need to provide a placeholder `id`, and consumers reading `plugin.id` must handle `undefined`.
- **`AgtkDatabase.getFieldByIndex(arg1, arg2)` return type changed to `string | null` (`#70`)**:
  - Updated from `string` to `string | null` to match runtime behavior when a field is not found. Consumers must handle `null` before passing the value where a `string` is required.
- **Removed global `Window.kt` augmentation from `pgmmv.d.ts` (`#77`)**:
  - `pgmmv.d.ts` now declares only the PGMMV/Cocos globals (`Agtk`, `cc`, `jsb`) without extending `Window`.
  - **Migration**: Plugins that attach custom properties to `window` (such as `window.kt`) must declare their own `interface Window` augmentation in consumer code.
- **Generated `dist/` declaration entry point & explicit `exports` map (`#77`)**:
  - `package.json` replaces `"main": "lib/index.ts"` with `"types": "./dist/index.d.ts"` and defines an explicit `"exports"` map (`.`, `./pgmmv.d.ts`, `./lib/*`, `./package.json`). Imports targeting unexported paths (such as `@kidthales/pgmmv-types/dist/...`) are rejected under `moduleResolution: "node16"`, `"nodenext"`, and `"bundler"`.
  - Local development tooling now requires Node.js `>=22.2.0` (`engines.node`).

### Added

- **Deterministic `node16`-clean `dist/` declaration generator (`tools/generate.mjs`)**: Added `npm run generate` to emit `.d.ts` files from `lib/` into `dist/` with zero runtime `.js` files, explicit `.js` / `/index.js` relative specifiers, `with { 'resolution-mode': 'import' }` attributes for `type-fest`, and strict `tsc --moduleResolution node16` validation (`#77`).
- **AutoTile declarations (`lib/agtk/plugins/plugin/auto-tile-parameters.interface.ts`)**: Added `AgtkAutoTileParameters` (`AgtkParameter[]`), `AgtkAutoTileCommand`, `AgtkAutoTileUpdateArea`, `AgtkAutoTileCallMap`, and `AgtkAutoTileCallResult<C>`, and typed `AgtkPlugin.call`, `AgtkPlugin.getAttribute`, and `AgtkPlugin.getBorderType` (`#70`, `#77`).
- **Root module & plugin helper exports (`lib/index.ts`, `dist/index.d.ts`)**: Re-exported `./agtk/plugins/plugin` and `./agtk/plugins/plugin/parameter` from the package root, and added `AgtkPluginInfoMap<I>`, `AgtkPluginInfoResult<C, I>`, `AgtkPluginInfoCategoryValue`, and `AgtkParameterTypeValue` (`#70`, `#77`).
- **`AgtkObjects.getIdList()`**: Added missing `getIdList(): number[]` declaration to `AgtkObjects` (`#70`).
- **Public npm metadata**: Configured `publishConfig` (`https://registry.npmjs.org/`, `access: "public"`), `sideEffects: false`, `files`, `homepage`, `bugs`, and `keywords` (`#77`).
- **Zero-bloat TypeScript 7 toolchain & test suite**: Adopted `typescript@^7.0.2`, `yaml@^2.9.1`, and `acorn@^8.19.0`; added `tools/lint.mjs` (exports audit, lockfile parity, `.mjs` syntax checks, ES5 AST verification for `test/plugin.fixture.js`, and tracked agent/scratch file guard), `tests/fixtures/tsc/{tsconfig.bundler.json,tsconfig.node16.json,consumer.ts}`, `tests/types.test.mjs`, and `tests/tools.test.mjs` wired to `npm run check:types`, `npm run lint`, and `npm test` (`#70`, `#77`).

### Changed

- **String literal widening for enums (`#70`)**: Widened `AgtkPluginInfoCategory`, `AgtkParameterType`, and parameter `type` unions via `AgtkPluginInfoCategoryValue`, `AgtkParameterTypeValue`, and template literal enum unions so plain-JS and TypeScript consumers can pass either enum members or string literals.
- **Parameter interface refinements (`#70`, `#77`)**:
  - Made `AgtkBaseSwitchOrVariableIdParameter.referenceId` optional and widened its type to `number | string`.
  - Required `sourceId: number | string` on `AgtkEmbeddedParameter` while keeping `sourceId?: number | string` optional on `AgtkBaseEmbeddedParameter` (preserving optional `sourceId` on `AgtkEmbeddedEditableParameter`).
- **Global reference update (`pgmmv.d.ts`)**: Updated `pgmmv.d.ts` to import `{ Agtk, cc, jsb }` from `./dist/index.js` (`#77`).
- **Dependency cleanup**: Synchronized `package.json` and `package-lock.json` to `0.2.0-alpha.1` and removed legacy ESLint, `@typescript-eslint/*`, `@eslint/eslintrc`, Prettier, and `concurrently` dependencies and config files (`#77`).

### Fixed

- **Manager `getIdList()` return types (`#70`)**: Fixed `getIdList()` returning `number` (or `number | null`) instead of `number[]` (or `number[] | null`) on `AgtkAnimations`, `AgtkBGMS`, `AgtkDatabases`, `AgtkFonts`, `AgtkMovies`, `AgtkSES`, `AgtkTexts`, and `AgtkVoices`.
- **`AgtkDatabase` column and row getters (`#70`)**: Typed `getColumnByIndex`, `getColumnByName`, `getRowByIndex`, and `getRowByName` as returning `string[] | null` instead of `unknown[] | null`.
- **`AgtkUi` property types (`#70`)**: Typed `AgtkUi.editSceneId` and `AgtkUi.editLayerIndex` as `number` instead of `unknown`.

## [0.1.1] - 2026-02-28

### Changed

- Updated package version and `.gitattributes` `export-ignore` rules (`#1`).

## [0.1.0] - 2026-02-27

### Added

- Initial TypeScript declarations for PGMMV (`Agtk`, `cc`, `jsb`) and ambient `pgmmv.d.ts` entry point.
