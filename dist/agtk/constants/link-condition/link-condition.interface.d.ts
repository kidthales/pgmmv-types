/**
 * Agtk link condition constants interface module.
 *
 * @packageDocumentation
 */
import type { AgtkAttackAreaNear } from './attack-area-near/index.js';
import type { AgtkAttackAreaTouched } from './attack-area-touched/index.js';
import type { AgtkLocked } from './locked/index.js';
import type { AgtkObjectFacingDirection } from './object-facing-direction/index.js';
import type { AgtkObjectFacingEachOther } from './object-facing-each-other/index.js';
import type { AgtkObjectFacing } from './object-facing/index.js';
import type { AgtkObjectFound } from './object-found/index.js';
import type { AgtkObjectHit } from './object-hit/index.js';
import type { AgtkObjectNear } from './object-near/index.js';
import type { AgtkObjectWallTouched } from './object-wall-touched/index.js';
import type { AgtkSlopeTouched } from './slope-touched/index.js';
/**
 * Link condition constants interface.
 */
export interface AgtkLinkCondition {
    /**
     * Object wall touched.
     */
    readonly objectWallTouched: AgtkObjectWallTouched;
    /**
     * Object hit.
     */
    readonly objectHit: AgtkObjectHit;
    /**
     * Attack area touched.
     */
    readonly attackAreaTouched: AgtkAttackAreaTouched;
    /**
     * Attack area near.
     */
    readonly attackAreaNear: AgtkAttackAreaNear;
    /**
     * Object near.
     */
    readonly objectNear: AgtkObjectNear;
    /**
     * Object facing each other.
     */
    readonly objectFacingEachOther: AgtkObjectFacingEachOther;
    /**
     * Object facing.
     */
    readonly objectFacing: AgtkObjectFacing;
    /**
     * Object found.
     */
    readonly objectFound: AgtkObjectFound;
    /**
     * Object facing direction.
     */
    readonly objectFacingDirection: AgtkObjectFacingDirection;
    /**
     * Locked.
     */
    readonly locked: AgtkLocked;
    /**
     * Slope touched.
     */
    readonly slopeTouched: AgtkSlopeTouched;
}
