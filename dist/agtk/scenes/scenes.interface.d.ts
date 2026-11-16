/**
 * Agtk scenes interface module.
 *
 * @packageDocumentation
 */
import type { AgtkLayer } from '../layers/layer/index.js';
import type { AgtkScene } from './scene/index.js';
/**
 * Agtk scenes interface.
 */
export interface AgtkScenes {
    /**
     *
     */
    getCount(): number;
    /**
     *
     * @param arg
     */
    getIdByIndex(arg: number): number;
    /**
     *
     * @param arg
     */
    getIdByName(arg: string): number;
    /**
     *
     */
    getIdList(): number[];
    /**
     *
     * @param arg
     */
    get(arg: number): AgtkScene;
    /**
     *
     * @param arg
     */
    getLayerById(arg: number): AgtkLayer;
}
