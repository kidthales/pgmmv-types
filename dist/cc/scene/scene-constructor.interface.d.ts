/**
 * Cocos scene constructor interface module.
 *
 * @packageDocumentation
 */
import type { CCNodeConstructor } from '../node/index.js';
import type { CCScene } from './scene.interface.js';
/**
 * Cocos scene constructor interface.
 *
 * @constructor
 */
export interface CCSceneConstructor<T extends CCScene = CCScene, U extends any[] = never> extends CCNodeConstructor<T, U> {
}
