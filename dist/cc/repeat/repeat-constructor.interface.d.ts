/**
 * Cocos repeat constructor interface module.
 *
 * @packageDocumentation
 */
import type { CCActionIntervalConstructor } from '../action-interval/index.js';
import type { CCFiniteTimeAction } from '../finite-time-action/index.js';
import type { CCRepeat } from './repeat.interface.js';
/**
 * Cocos repeat constructor interface.
 *
 * @param action
 * @param times
 * @constructor
 */
export interface CCRepeatConstructor<T extends CCRepeat = CCRepeat, U extends any[] = [CCFiniteTimeAction?, number?]> extends CCActionIntervalConstructor<T, U> {
}
