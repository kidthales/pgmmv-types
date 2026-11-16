/**
 * Cocos sprite batch node constructor interface module.
 *
 * @packageDocumentation
 */
import type { CCNodeConstructor } from '../node/index.js';
import type { CCTexture2D } from '../texture-2d/index.js';
import type { CCSpriteBatchNode } from './sprite-batch-node.interface.js';
/**
 * Cocos sprite batch node constructor interface.
 *
 * @param fileImage
 * @constructor
 */
export interface CCSpriteBatchNodeConstructor<T extends CCSpriteBatchNode = CCSpriteBatchNode, U extends any[] = [string | CCTexture2D]> extends CCNodeConstructor<T, U> {
    /**
     * @deprecated since v3.0, please use new construction instead.
     */
    createWithTexture(...args: U): T;
}
