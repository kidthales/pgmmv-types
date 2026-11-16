/**
 * Cocos ray interface module.
 *
 * @packageDocumentation
 */
import type { CCVec3 } from './vec-3.interface.js';
/**
 * Cocos ray interface.
 */
export interface CCRay {
    origin: CCVec3;
    direction: CCVec3;
}
