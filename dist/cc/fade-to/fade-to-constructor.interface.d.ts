/**
 * Cocos fade to constructor interface module.
 *
 * @packageDocumentation
 */
import type { CCActionIntervalConstructor } from '../action-interval/index.js';
import type { CCFadeTo } from './fade-to.interface.js';
/**
 * Cocos fade to constructor interface.
 *
 * @param duration Duration in seconds.
 * @param opacity 0-255, 0 is transparent.
 * @constructor
 */
export interface CCFadeToConstructor<T extends CCFadeTo = CCFadeTo, U extends any[] = [number?, number?]> extends CCActionIntervalConstructor<T, U> {
    /**
     * Please use cc.fadeTo instead.
     * Fades an object that implements the cc.RGBAProtocol protocol.
     * It modifies the opacity from the current value to a custom one.
     *
     * @param duration Duration in seconds.
     * @param opacity 0-255, 0 is transparent.
     * @deprecated since v3.0 please use cc.fadeTo instead.
     */
    create(...args: U): T;
}
