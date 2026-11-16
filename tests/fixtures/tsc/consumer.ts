import type {} from '@kidthales/pgmmv-types/pgmmv.d.ts';
import type {
  Agtk as AgtkNamespace,
  cc as CcNamespace,
  jsb as JsbNamespace,
  AgtkPlugin,
  AgtkPluginInfoCategory,
  AgtkPluginInfoMap,
  AgtkPluginInfoResult,
  AgtkAutoTileCommand,
  AgtkAutoTileUpdateArea,
  AgtkAutoTileCallMap,
  AgtkAutoTileCallResult,
  AgtkEmbeddedParameter,
  AgtkEmbeddedEditableParameter,
  AgtkParameter
} from '@kidthales/pgmmv-types';

// Verify global namespaces exposed by pgmmv.d.ts match root module exports
const agtkRef: AgtkNamespace = Agtk;
const ccRef: CcNamespace = cc;
const jsbRef: JsbNamespace = jsb;

// Verify AgtkPluginInfoResult works with string literals, enum members, and custom internal state
type ParamsByLiteral = AgtkPluginInfoResult<'parameter'>;
type ParamsByEnum = AgtkPluginInfoResult<AgtkPluginInfoCategory.Parameter>;
type CustomInternal = AgtkPluginInfoResult<'internal', { count: number }>;

const paramsFromLiteral: ParamsByLiteral = [] satisfies AgtkParameter[];
const paramsFromEnum: ParamsByEnum = [] satisfies AgtkPluginInfoMap['parameter'];
const customInternal: CustomInternal = { count: 1 };

// Verify AgtkAutoTileCallResult and AgtkAutoTileUpdateArea host helpers
type HorzCountResult = AgtkAutoTileCallResult<'getHorzCount'>;
type AttrListResult = AgtkAutoTileCallResult<'getAttributeList'>;
type UpdateAreaResult = AgtkAutoTileCallResult<'updateArea'>;

const horzCount: HorzCountResult = 4;
const attrList: AttrListResult = ['ground'];
const updateArea: AgtkAutoTileUpdateArea = [0, 0, 4, 4];
const autoTileCommand: AgtkAutoTileCommand = 'updateArea';
const autoTileCallMapCheck: AgtkAutoTileCallMap['getVertCount'] = 2;
const updateAreaResultCheck: UpdateAreaResult = undefined;

// Verify AgtkEmbeddedParameter requires sourceId (number | string) while AgtkEmbeddedEditableParameter keeps it optional
const embeddedNumeric: AgtkEmbeddedParameter = {
  id: 1,
  name: 'Numeric Source',
  type: 'Embedded',
  sourceId: 100
};
const embeddedString: AgtkEmbeddedParameter = {
  id: 2,
  name: 'String Source',
  type: 'Embedded',
  sourceId: 'source-id'
};
const embeddedEditableNoSource: AgtkEmbeddedEditableParameter = {
  id: 3,
  name: 'Editable No Source',
  type: 'EmbeddedEditable',
  reference: 'text'
};

// Verify AgtkPlugin implementation compiles cleanly
const samplePlugin: AgtkPlugin<{ count: number }> = {
  setLocale() {},
  getInfo(category) {
    if (category === 'name') {
      return 'Consumer Fixture';
    }
    return undefined;
  },
  initialize() {},
  finalize() {},
  setParamValue() {},
  setInternal() {},
  call() {
    return horzCount;
  }
};

// Negative compile-time assertions
// @ts-expect-error Window.kt augmentation must not exist globally (N7)
const forbiddenWindowKt = window.kt;

// @ts-expect-error AgtkEmbeddedParameter requires sourceId (N5)
const missingEmbeddedSource: AgtkEmbeddedParameter = {
  id: 4,
  name: 'Missing Source',
  type: 'Embedded'
};

// @ts-expect-error Invalid getInfo category rejected by AgtkPluginInfoResult
type InvalidInfoResult = AgtkPluginInfoResult<'invalidCategory'>;

// @ts-expect-error Invalid auto-tile command rejected by AgtkAutoTileCallResult
type InvalidAutoTileResult = AgtkAutoTileCallResult<'invalidCommand'>;

// @ts-expect-error Agtk.animations.getIdList() returns number[], not number
const invalidIdList: number = Agtk.animations.getIdList();

export type {
  InvalidInfoResult,
  InvalidAutoTileResult
};

export {
  agtkRef,
  ccRef,
  jsbRef,
  paramsFromLiteral,
  paramsFromEnum,
  customInternal,
  attrList,
  updateArea,
  autoTileCommand,
  autoTileCallMapCheck,
  updateAreaResultCheck,
  embeddedNumeric,
  embeddedString,
  embeddedEditableNoSource,
  samplePlugin,
  forbiddenWindowKt,
  missingEmbeddedSource,
  invalidIdList
};
