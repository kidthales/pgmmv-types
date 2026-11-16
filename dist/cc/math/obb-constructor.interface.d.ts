/**
 * Cocos OBB constructor interface module.
 *
 * @packageDocumentation
 */
import type { Constructor } from '../../_shared/index.js';
import type { CCAABB } from './aabb.interface.js';
import type { CCOBB } from './obb.interface.js';
/**
 * Cocos OBB constructor interface.
 *
 * @param aabb
 * @constructor
 */
export interface CCOBBConstructor<T extends CCOBB = CCOBB, U extends any[] = [CCAABB]> extends Constructor<T, U> {
}
