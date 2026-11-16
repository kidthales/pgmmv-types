/**
 * Agtk movies interface module.
 *
 * @packageDocumentation
 */
import type { AgtkMovie } from './movie/index.js';
/**
 * Agtk movies interface.
 */
export interface AgtkMovies {
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
    get(arg: number): AgtkMovie;
}
