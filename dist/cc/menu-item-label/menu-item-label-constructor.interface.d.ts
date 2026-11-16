/**
 * Cocos menu item label constructor interface module.
 *
 * @packageDocumentation
 */
import type { CCMenuItemConstructor } from '../menu-item/index.js';
import { CCNode } from '../node/index.js';
import type { CCMenuItemLabel } from './menu-item-label.interface.js';
/**
 * Cocos menu item label constructor interface.
 *
 * @param label
 * @param selector
 * @param target
 * @constructor
 */
export interface CCMenuItemLabelConstructor<T extends CCMenuItemLabel = CCMenuItemLabel, U extends any[] = [CCNode?, (Function | string)?, CCNode?]> extends CCMenuItemConstructor<T, U> {
}
