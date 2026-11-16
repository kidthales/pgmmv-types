/**
 * Agtk objects constants interface module.
 *
 * @packageDocumentation
 */
import type { AgtkSwitches } from './switches/index.js';
import type { AgtkVariables } from './variables/index.js';
/**
 * Agtk objects constants interface.
 */
export interface AgtkObjects {
    /**
     * Switches.
     */
    readonly switches: AgtkSwitches;
    /**
     * Variables.
     */
    readonly variables: AgtkVariables;
}
