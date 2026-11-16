/**
 * Cocos sequence constructor interface module.
 *
 * @packageDocumentation
 */
import type { CCActionIntervalConstructor } from '../action-interval/index.js';
import type { CCFiniteTimeAction } from '../finite-time-action/index.js';
import type { CCSequence } from './sequence.interface.js';
/**
 * Cocos sequence constructor interface.
 *
 * @param tempArray
 * @param actionTwo
 * @constructor
 */
export interface CCSequenceConstructor<T extends CCSequence = CCSequence, U extends any[] = [CCFiniteTimeAction | CCFiniteTimeAction[], CCFiniteTimeAction?]> extends CCActionIntervalConstructor<T, U> {
}
