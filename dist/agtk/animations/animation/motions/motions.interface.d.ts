/**
 * Agtk animation motions interface module.
 *
 * @packageDocumentation
 */
import type { AgtkMotion } from './motion/index.js';
/**
 * Motion data.
 */
export interface AgtkMotions {
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
    get(arg: number): AgtkMotion;
}
