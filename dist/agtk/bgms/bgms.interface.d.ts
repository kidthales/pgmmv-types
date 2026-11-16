/**
 * Agtk background musics interface module.
 *
 * @packageDocumentation
 */
import type { AgtkBGM } from './bgm/index.js';
/**
 * Agtk background musics interface.
 */
export interface AgtkBGMS {
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
    get(arg: number): AgtkBGM;
}
