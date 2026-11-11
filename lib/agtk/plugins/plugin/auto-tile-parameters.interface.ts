/**
 * Agtk plugin auto tile parameters interface module.
 *
 * @packageDocumentation
 */

import type { AgtkParameter } from './parameter';

/**
 * Agtk plugin auto tile parameters type.
 *
 * Defines auto-tile parameters displayed beneath the plug-in selection item
 * on the tileset settings screen. Description matches plug-in parameter definition.
 */
export type AgtkAutoTileParameters = AgtkParameter[];

/**
 * Auto-tile command names dispatched to `AgtkPlugin.call`.
 */
export type AgtkAutoTileCommand =
  | 'getHorzCount'
  | 'getVertCount'
  | 'getFrontTileList'
  | 'getBackTileList'
  | 'getAttributeList'
  | 'updateArea'
  | 'onParamChanged';

/**
 * Tile area tuple `[tileStartX, tileStartY, horzTileCount, vertTileCount]` passed to `updateArea`.
 */
export type AgtkAutoTileUpdateArea = [
  tileStartX: number,
  tileStartY: number,
  horzTileCount: number,
  vertTileCount: number
];

/**
 * Host-side return type mapping for auto-tile `AgtkPlugin.call` commands.
 */
export interface AgtkAutoTileCallMap {
  getHorzCount: number;
  getVertCount: number;
  getFrontTileList: unknown[];
  getBackTileList: unknown[];
  getAttributeList: string[];
  updateArea: void;
  onParamChanged: void;
}
