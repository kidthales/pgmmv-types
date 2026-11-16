/**
 * Agtk common switches key type module.
 *
 * @packageDocumentation
 */
import type { AgtkSwitches } from './switches.interface.js';
/**
 * Agtk common switches key type.
 */
export type AgtkSwitchesKey = Exclude<keyof AgtkSwitches, 'get' | 'getIdByName'>;
