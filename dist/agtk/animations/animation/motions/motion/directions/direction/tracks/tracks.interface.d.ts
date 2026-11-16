/**
 * Agtk animation motion direction tracks interface module.
 *
 * @packageDocumentation
 */
import type { AgtkTrack } from './track/index.js';
/**
 * Track data.
 */
export interface AgtkTracks {
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
    get(arg: number): AgtkTrack;
}
