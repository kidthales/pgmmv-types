/**
 * Cocos acceleration constructor interface module.
 *
 * @packageDocumentation
 */
import type { Constructor } from '../../_shared/index.js';
import type { CCAcceleration } from './acceleration.interface.js';
/**
 * Cocos acceleration constructor interface.
 *
 * @param x
 * @param y
 * @param z
 * @param timestamp
 * @constructor
 */
export interface CCAccelerationConstructor<T extends CCAcceleration = CCAcceleration, U extends any[] = [number?, number?, number?, number?]> extends Constructor<T, U> {
}
