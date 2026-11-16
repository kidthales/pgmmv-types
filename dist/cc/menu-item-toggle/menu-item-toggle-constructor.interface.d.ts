/**
 * Cocos menu item toggle constructor interface module.
 *
 * @packageDocumentation
 */
import type { CCMenuItem, CCMenuItemConstructor } from '../menu-item/index.js';
import type { CCNode } from '../node/index.js';
import type { CCMenuItemToggle } from './menu-item-toggle.interface.js';
/**
 * Cocos menu item toggle constructor interface.
 *
 * @param params
 * @constructor
 */
export interface CCMenuItemToggleConstructor<T extends CCMenuItemToggle = CCMenuItemToggle, U extends any[] = [...CCMenuItem[], Function | string | undefined, CCNode | undefined]> extends CCMenuItemConstructor<T, U> {
}
