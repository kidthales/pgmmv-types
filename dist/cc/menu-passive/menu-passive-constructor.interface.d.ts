/**
 * Cocos menu passive constructor interface module.
 *
 * @packageDocumentation
 */
import type { CCLayerConstructor } from '../layer/index.js';
import { CCMenuItem } from '../menu-item/index.js';
import type { CCMenuPassive } from './menu-passive.interface.js';
/**
 * Cocos menu passive constructor interface.
 *
 * @param menuItem
 * @constructor
 */
export interface CCMenuPassiveConstructor<T extends CCMenuPassive = CCMenuPassive, U extends any[] = [...CCMenuItem[]]> extends CCLayerConstructor<T, U> {
}
