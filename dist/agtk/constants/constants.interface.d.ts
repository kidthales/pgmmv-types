/**
 * Agtk constants interface module.
 *
 * @packageDocumentation
 */
import type { AgtkActionCommands } from './action-commands/index.js';
import type { AgtkAnimations } from './animations/index.js';
import type { AgtkAssignments } from './assignments/index.js';
import type { AgtkAttackAttributes } from './attack-attributes/index.js';
import type { AgtkConditions } from './conditions/index.js';
import type { AgtkControllers } from './controllers/index.js';
import type { AgtkDatabaseTemplateTypes } from './database-template-types/index.js';
import type { AgtkDirection } from './direction/index.js';
import type { AgtkFilterEffects } from './filter-effects/index.js';
import type { AgtkLinkCondition } from './link-condition/index.js';
import type { AgtkObjectGroup } from './object-group/index.js';
import type { AgtkObjectType } from './object-type/index.js';
import type { AgtkObjects } from './objects/index.js';
import type { AgtkQualifier } from './qualifier/index.js';
import type { AgtkSwitchVariableObjects } from './switch-variable-objects/index.js';
import type { AgtkSystemLayers } from './system-layers/index.js';
import type { AgtkTileGroup } from './tile-group/index.js';
import type { AgtkTile } from './tile/index.js';
import type { AgtkTracks } from './tracks/index.js';
/**
 * Agtk constants interface.
 */
export interface AgtkConstants {
    /**
     * Action commands.
     */
    readonly actionCommands: AgtkActionCommands;
    /**
     * Link condition.
     */
    readonly linkCondition: AgtkLinkCondition;
    /**
     * Conditions.
     */
    readonly conditions: AgtkConditions;
    /**
     * Assignments.
     */
    readonly assignments: AgtkAssignments;
    /**
     * Attack attributes.
     */
    readonly attackAttributes: AgtkAttackAttributes;
    /**
     * Filter effects.
     */
    readonly filterEffects: AgtkFilterEffects;
    /**
     * System layers.
     */
    readonly systemLayers: AgtkSystemLayers;
    /**
     * Qualifier.
     */
    readonly qualifier: AgtkQualifier;
    /**
     * Object type.
     *
     * @deprecated
     */
    readonly objectType: AgtkObjectType;
    /**
     * Object group.
     */
    readonly objectGroup: AgtkObjectGroup;
    /**
     * Tile group.
     */
    readonly tileGroup: AgtkTileGroup;
    /**
     * Tile.
     */
    readonly tile: AgtkTile;
    /**
     * Direction.
     */
    readonly direction: AgtkDirection;
    /**
     * Controllers.
     */
    readonly controllers: AgtkControllers;
    /**
     * Animations.
     */
    readonly animations: AgtkAnimations;
    /**
     * Tracks.
     */
    readonly tracks: AgtkTracks;
    /**
     * Objects.
     */
    readonly objects: AgtkObjects;
    /**
     * Switch variable objects.
     */
    readonly switchVariableObjects: AgtkSwitchVariableObjects;
    /**
     * Database template types.
     */
    readonly databaseTemplateTypes: AgtkDatabaseTemplateTypes;
}
