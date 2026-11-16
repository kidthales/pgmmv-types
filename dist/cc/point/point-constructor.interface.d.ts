/**
 * Cocos point constructor interface module.
 *
 * @packageDocumentation
 */
import type { Constructor } from '../../_shared/index.js';
import type { CCPoint } from './point.interface.js';
/**
 * Cocos point constructor interface.
 *
 * @param x
 * @param y
 * @constructor
 */
export interface CCPointConstructor<T extends CCPoint = CCPoint, U extends any[] = [number, number]> extends Constructor<T, U> {
}
