/**
 * Cocos rectangle constructor interface module.
 *
 * @packageDocumentation
 */
import type { Constructor } from '../../_shared/index.js';
import type { CCRect } from './rect.interface.js';
/**
 * Cocos rectangle constructor interface.
 *
 * @param x
 * @param y
 * @param width
 * @param height
 * @constructor
 */
export interface CCRectConstructor<T extends CCRect = CCRect, U extends any[] = [number, number, number, number]> extends Constructor<T, U> {
}
