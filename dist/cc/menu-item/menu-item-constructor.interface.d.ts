/**
 * Cocos menu item constructor interface module.
 *
 * @packageDocumentation
 */
import type { CCNode, CCNodeConstructor } from '../node/index.js';
import type { CCMenuItem } from './menu-item.interface.js';
/**
 * Cocos menu item constructor interface.
 *
 * @param callback
 * @param target
 * @constructor
 */
export interface CCMenuItemConstructor<T extends CCMenuItem = CCMenuItem, U extends any[] = [(Function | string)?, CCNode?]> extends CCNodeConstructor<T, U> {
}
