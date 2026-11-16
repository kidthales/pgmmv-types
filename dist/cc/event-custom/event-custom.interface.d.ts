/**
 * Cocos event custom interface module.
 *
 * @packageDocumentation
 */
import type { CCEvent } from '../event/index.js';
/**
 * The custom event.
 */
export interface CCEventCustom extends CCEvent {
    /**
     * Gets event name.
     */
    getEventName(): string;
    /**
     * Gets user data.
     */
    getUserData<T>(): T;
    /**
     * Sets user data.
     *
     * @param data
     */
    setUserData<T>(data: T): void;
}
