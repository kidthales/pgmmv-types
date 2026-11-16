/**
 * Agtk objects interface module.
 *
 * @packageDocumentation
 */
import type { AgtkObject } from './object/index.js';
/**
 * Agtk objects interface.
 */
export interface AgtkObjects {
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
    get(arg: number): AgtkObject;
}
