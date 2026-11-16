/**
 * Cocos color constructor interface module.
 *
 * @packageDocumentation
 */
import type { Constructor } from '../../_shared/index.js';
import type { CCColor } from './color.interface.js';
/**
 * Cocos color constructor interface.
 *
 * @param r
 * @param g
 * @param b
 * @param a
 * @constructor
 */
export interface CCColorConstructor<T extends CCColor = CCColor, U extends any[] = [number, number, number, number]> extends Constructor<T, U> {
}
