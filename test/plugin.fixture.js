// @ts-check
/// <reference path="../pgmmv.d.ts" />
/* global Agtk, window */

(function () {
  /** @type {import('../lib/agtk/plugins/plugin').AgtkLinkCondition} */
  var linkCondition = {
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
        }
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
            return 'Verifies plain ES5 checkJs compatibility.';
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
        if (!window.kt) {
          window.kt = {};
        }

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
          // @ts-expect-error negative test: getIdList() returns number[], not scalar number
          /** @type {number} */ invalidScalarIdList = Agtk.animations.getIdList(),
          // @ts-expect-error negative test: invalid AgtkPluginInfoCategory rejected
          invalidInfo = plugin.getInfo('invalidCategory');

        if (dbIds === null || field === null || invalidInfo !== undefined) {
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
