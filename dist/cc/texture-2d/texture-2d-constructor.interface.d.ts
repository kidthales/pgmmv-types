/**
 * Cocos texture 2D constructor interface module.
 *
 * @packageDocumentation
 */
import type { CCClassConstructor } from '../class/index.js';
import type { CCTexture2D } from './texture-2d.interface.js';
/**
 * Cocos texture 2D constructor interface.
 *
 * @constructor
 */
export interface CCTexture2DConstructor<T extends CCTexture2D = CCTexture2D, U extends any[] = never> extends CCClassConstructor<T, U> {
}
