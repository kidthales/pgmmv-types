/**
 * Agtk sound effects interface module.
 *
 * @packageDocumentation
 */
import type { AgtkSE } from './se/index.js';
/**
 * Agtk sound effects interface.
 */
export interface AgtkSES {
    /**
     *
     */
    getIdList(): number[];
    /**
     *
     * @param arg
     */
    getIdByName(arg: string): number;
    /**
     *
     * @param arg
     */
    get(arg: number): AgtkSE;
}
