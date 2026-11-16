/**
 * Cocos event manager constructor interface module.
 *
 * @packageDocumentation
 */
import type { Constructor } from '../../_shared/index.js';
import type { CCEventManager } from './event-manager.interface.js';
/**
 * Cocos event manager constructor interface.
 *
 * @constructor
 */
export interface CCEventManagerConstructor<T extends CCEventManager = CCEventManager, U extends any[] = never> extends Constructor<T, U> {
}
