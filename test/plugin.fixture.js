// @ts-check
/// <reference path="../pgmmv.d.ts" />
/* global Agtk, window */

/**
 * Plain-JS `@ts-check` compatibility fixture for `@kidthales/pgmmv-types`.
 *
 * Type-checked against `tsconfig.json` (`lib: ["es2020", "dom"]`) and validated
 * separately for ES5 syntax (`ecmaVersion: 5`, `sourceType: "script"`) by
 * `tools/lint.mjs` via `acorn`. Note that `tsconfig.json`'s `es2020` lib does
 * not restrict ES2015+ standard library methods; runtime ES5 API discipline
 * remains the author's responsibility.
 */

(function () {
  /** @type {import('../lib/agtk/plugins/plugin/parameter').AgtkEmbeddedEditableParameter} */
  var editableParam = {
      id: 3,
      name: 'Embedded Editable Preview',
      type: 'EmbeddedEditable',
      reference: 'text'
    },
    /** @type {import('../lib/agtk/plugins/plugin').AgtkLinkCondition} */
    linkCondition = {
      id: 0,
      name: 'Fixture Link Condition',
      description: 'Verifies SwitchVariableObjectId and numeric referenceId.',
      parameter: [
        {
          id: 100,
          name: 'Variable Source',
          type: 'SwitchVariableObjectId',
          option: ['SelfObject', 'ParentObject'],
          defaultValue: -1
        },
        {
          id: 1,
          name: 'Target Variable',
          type: 'VariableId',
          referenceId: 100,
          withNewButton: true,
          defaultValue: -1
        },
        {
          id: 2,
          name: 'Embedded Preview',
          type: 'Embedded',
          sourceId: 100,
          width: 32,
          height: 32,
          defaultValue: -1
        },
        editableParam
      ]
    },
    /** @type {import('../lib/agtk/plugins/plugin').AgtkPlugin} */
    plugin = {
      setLocale: function () {},

      getInfo: function (category) {
        switch (category) {
          case 'name':
            return 'PGMMV Types Regression Fixture';
          case 'description':
            return 'Verifies plain-JS @ts-check compatibility.';
          case 'author':
            return 'kidthales <kidthales@agogpixel.com>';
          case 'help':
            return 'Regression fixture for @kidthales/pgmmv-types.';
          case 'parameter':
            return [];
          case 'internal':
            return null;
          case 'actionCommand':
            return [];
          case 'linkCondition':
            return [linkCondition];
          default:
            break;
        }
      },

      initialize: function () {
        var animIds = Agtk.animations.getIdList(),
          bgmIds = Agtk.bgms.getIdList(),
          fontIds = Agtk.fonts.getIdList(),
          imageIds = Agtk.images.getIdList(),
          movieIds = Agtk.movies.getIdList(),
          objectIds = Agtk.objects.getIdList(),
          sceneIds = Agtk.scenes.getIdList(),
          seIds = Agtk.ses.getIdList(),
          textIds = Agtk.texts.getIdList(),
          tilesetIds = Agtk.tilesets.getIdList(),
          voiceIds = Agtk.voices.getIdList(),
          dbIds = Agtk.databases.getIdList(),
          db = Agtk.databases.get(dbIds ? dbIds[0] : 0),
          colByIndex = db ? db.getColumnByIndex(0) : null,
          colByName = db ? db.getColumnByName('id') : null,
          rowByIndex = db ? db.getRowByIndex(0) : null,
          rowByName = db ? db.getRowByName('default') : null,
          field = db ? db.getFieldByIndex(0, 0) : null,
          sceneId = Agtk.ui.editSceneId,
          layerIndex = Agtk.ui.editLayerIndex,
          /** @type {import('../lib/agtk/plugins/plugin').AgtkPluginInfoResult<'parameter'>} */
          typedParams = /** @type {import('../lib/agtk/plugins/plugin').AgtkPluginInfoResult<'parameter'>} */ (
            plugin.getInfo('parameter')
          ),
          /** @type {import('../lib/agtk/plugins/plugin').AgtkAutoTileCallResult<'getHorzCount'>} */
          horzCount = /** @type {import('../lib/agtk/plugins/plugin').AgtkAutoTileCallResult<'getHorzCount'>} */ (
            autoTilePlugin.call([], 'getHorzCount')
          ),
          // @ts-expect-error negative test: getIdList() returns number[], not scalar number
          /** @type {number} */ invalidScalarIdList = Agtk.animations.getIdList(),
          // @ts-expect-error negative test: invalid AgtkPluginInfoCategory rejected
          invalidInfo = plugin.getInfo('invalidCategory'),
          // @ts-expect-error negative test: Window.kt is not globally augmented
          invalidWindowKt = window.kt,
          // @ts-expect-error negative test: AgtkEmbeddedParameter requires sourceId
          /** @type {import('../lib/agtk/plugins/plugin/parameter').AgtkEmbeddedParameter} */ invalidEmbedded = {
            id: 4,
            name: 'Missing Source',
            type: 'Embedded'
          };

        if (
          dbIds === null ||
          field === null ||
          invalidInfo !== undefined ||
          invalidWindowKt ||
          invalidEmbedded ||
          typedParams.length === 0 ||
          horzCount < 0
        ) {
          Agtk.log('Negative boundary error: ' + String(invalidScalarIdList));
        }

        Agtk.log(
          String(
            animIds.length +
              bgmIds.length +
              fontIds.length +
              imageIds.length +
              movieIds.length +
              objectIds.length +
              sceneIds.length +
              seIds.length +
              textIds.length +
              tilesetIds.length +
              voiceIds.length
          ) +
            String(colByIndex && colByIndex.length) +
            String(colByName && colByName.length) +
            String(rowByIndex && rowByIndex.length) +
            String(rowByName && rowByName.length) +
            String(field) +
            String(sceneId) +
            String(layerIndex)
        );
      },

      finalize: function () {},

      setParamValue: function () {},

      setInternal: function () {},

      call: function () {},

      update: function () {},

      execActionCommand: function () {
        return Agtk.constants.actionCommands.commandBehavior.CommandBehaviorNext;
      },

      execLinkCondition: function () {
        return false;
      }
    },
    /** @type {import('../lib/agtk/plugins/plugin').AgtkPlugin} */
    autoTilePlugin = {
      setLocale: function () {},

      getInfo: function (category) {
        switch (category) {
          case 'name':
            return 'PGMMV AutoTile Fixture';
          case 'autoTile':
            return [
              {
                id: 1,
                name: 'Horz Count',
                type: 'Number',
                defaultValue: 4
              }
            ];
          default:
            break;
        }
      },

      initialize: function () {},

      finalize: function () {},

      setParamValue: function () {},

      setInternal: function () {},

      call: function (paramValue, command) {
        if (command === 'getHorzCount' || command === 'getVertCount') {
          return paramValue && paramValue.length ? 4 : 2;
        }
        if (command === 'getFrontTileList' || command === 'getBackTileList') {
          return [];
        }
        if (command === 'getAttributeList') {
          return ['ground'];
        }
        return null;
      },

      getAttribute: function (paramValue, tileX, tileY) {
        return String((paramValue ? paramValue.length : 0) + tileX + tileY);
      },

      getBorderType: function (autoTileInfo, tileX, tileY) {
        return String(Boolean(autoTileInfo)) + ':' + String(tileX + tileY);
      }
    };

  if (autoTilePlugin.call([], 'getHorzCount') === 0) {
    Agtk.log('AutoTile check');
  }

  return plugin;
})();
