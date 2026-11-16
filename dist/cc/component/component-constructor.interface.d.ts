/**
 * Cocos component constructor interface module.
 *
 * @packageDocumentation
 */
import type { CCClassConstructor } from '../class/index.js';
import type { CCComponent } from './component.interface.js';
/**
 * Cocos component constructor interface.
 *
 * @constructor
 */
export interface CCComponentConstructor<T extends CCComponent = CCComponent, U extends any[] = never> extends CCClassConstructor<T, U> {
    /**
     * Allocates and initializes a component.
     *
     * @deprecated since v3.0, please use new construction instead.
     */
    create(...args: U): T;
}
