/**
 * Cocos action constructor interface module.
 *
 * @packageDocumentation
 */
import type { CCClassConstructor } from '../class/index.js';
import type { CCAction } from './action.interface.js';
/**
 * Cocos action constructor interface.
 *
 * @constructor
 */
export interface CCActionConstructor<T extends CCAction = CCAction, U extends any[] = never> extends CCClassConstructor<T, U> {
}
