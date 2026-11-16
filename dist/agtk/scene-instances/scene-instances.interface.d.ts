/**
 * Agtk scene instances interface module.
 *
 * @packageDocumentation
 */
import type { AgtkSceneInstance } from './scene-instance/index.js';
/**
 * Agtk scene instances interface.
 */
export interface AgtkSceneInstances {
    /**
     * Retrieves current scene.
     */
    getCurrent(): AgtkSceneInstance;
}
