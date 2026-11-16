/**
 * Cocos draw node constructor interface module.
 *
 * @packageDocumentation
 */
import type { CCNodeConstructor } from '../node/index.js';
import type { CCDrawNode } from './draw-node.interface.js';
/**
 * Cocos draw node constructor interface.
 *
 * @constructor
 */
export interface CCDrawNodeConstructor<T extends CCDrawNode = CCDrawNode, U extends any[] = never> extends CCNodeConstructor<T, U> {
}
