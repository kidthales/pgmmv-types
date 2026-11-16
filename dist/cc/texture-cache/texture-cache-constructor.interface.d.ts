/**
 * Cocos texture cache constructor interface module.
 *
 * @packageDocumentation
 */
import type { Constructor } from '../../_shared/index.js';
import type { CCTextureCache } from './texture-cache.interface.js';
/**
 * Cocos texture cache constructor interface.
 *
 * @constructor
 */
export interface CCTextureCacheConstructor<T extends CCTextureCache = CCTextureCache, U extends any[] = never> extends Constructor<T, U> {
    /**
     * @deprecated
     */
    getInstance(): T;
}
