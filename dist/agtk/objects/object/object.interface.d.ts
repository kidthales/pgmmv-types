/**
 * Agtk object interface module.
 *
 * @packageDocumentation
 */
import type { AgtkActions } from './actions/index.js';
import type { AgtkBullets } from './bullets/index.js';
import type { AgtkSwitches } from './switches/index.js';
import type { AgtkVariables } from './variables/index.js';
import type { AgtkViewports } from './viewports/index.js';
/**
 * Agtk object interface.
 */
export interface AgtkObject {
    /**
     * Readonly.
     */
    readonly id: number;
    /**
     * Readonly.
     */
    readonly name: string;
    /**
     * Operable via input device.
     */
    operatable: boolean;
    /**
     * Bullet data set in "Bullet Settings".
     */
    bullets: AgtkBullets;
    /**
     * Action program action box data.
     */
    actions: AgtkActions;
    /**
     * Field of vision, lighting data set in "Field of Vision, Lighting".
     */
    viewports: AgtkViewports;
    /**
     * Animation ID set by "Select Animation".
     */
    animationId: number;
    /**
     * Object switch information.
     */
    switches: AgtkSwitches;
    /**
     * Object variable information.
     */
    variables: AgtkVariables;
}
