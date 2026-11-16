/**
 * Cocos menu constructor interface module.
 *
 * @packageDocumentation
 */
import type { CCLayerConstructor } from '../layer/index.js';
import { CCMenuItem } from '../menu-item/index.js';
import type { CCMenu } from './menu.interface.js';
/**
 * Cocos menu constructor interface.
 *
 * @param menuItem
 * @constructor
 */
export interface CCMenuConstructor<T extends CCMenu = CCMenu, U extends any[] = [...CCMenuItem[]]> extends CCLayerConstructor<T, U> {
}
