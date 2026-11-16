/**
 * Cocos grid base constructor interface module.
 *
 * @packageDocumentation
 */
import type { CCClassConstructor } from '../class/index.js';
import type { CCRect } from '../rect/index.js';
import type { CCSize } from '../size/index.js';
import type { CCTexture2D } from '../texture-2d/index.js';
import type { CCGridBase } from './grid-base.interface.js';
/**
 * Cocos grid base constructor interface.
 *
 * @param gridSize
 * @param texture
 * @param flipped
 * @param rect
 * @constructor
 */
export interface CCGridBaseConstructor<T extends CCGridBase = CCGridBase, U extends any[] = [CCSize, CCTexture2D?, boolean?, CCRect?]> extends CCClassConstructor<T, U> {
    /**
     * Create one cc.GridBase Object.
     *
     * @param gridSize
     * @param texture
     * @param flipped
     * @param rect
     */
    create(...args: U): CCGridBase;
}
