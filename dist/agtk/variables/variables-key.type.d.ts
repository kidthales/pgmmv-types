/**
 * Agtk common variables key type module.
 *
 * @packageDocumentation
 */
import type { AgtkVariables } from './variables.interface.js';
/**
 * Agtk Common variables key type.
 */
export type AgtkVariablesKey = Exclude<keyof AgtkVariables, 'get' | 'getIdByName'>;
