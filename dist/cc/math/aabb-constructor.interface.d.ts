/**
 * Cocos AABB constructor interface module.
 *
 * @packageDocumentation
 */
import type { Constructor } from '../../_shared/index.js';
import type { CCAABB } from './aabb.interface.js';
import type { CCVec3 } from './vec-3.interface.js';
/**
 * Cocos AABB constructor interface.
 *
 * @param min
 * @param max
 * @constructor
 */
export interface CCAABBConstructor<T extends CCAABB = CCAABB, U extends any[] = [CCVec3?, CCVec3?]> extends Constructor<T, U> {
}
