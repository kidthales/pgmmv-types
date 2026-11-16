/**
 * Agtk object actions interface module.
 *
 * @packageDocumentation
 */
import type { AgtkAction } from './action/index.js';
/**
 * Action program action box data.
 */
export interface AgtkActions {
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
    get(arg: number): AgtkAction;
}
