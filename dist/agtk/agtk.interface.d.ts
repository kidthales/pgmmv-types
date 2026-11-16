/**
 * Agtk interface module.
 *
 * @packageDocumentation
 */
import type { AgtkActionCommands } from './action-commands/index.js';
import type { AgtkAnimations } from './animations/index.js';
import type { AgtkBGMS } from './bgms/index.js';
import type { AgtkConstants } from './constants/index.js';
import type { AgtkControllers } from './controllers/index.js';
import type { AgtkDatabases } from './databases/index.js';
import type { AgtkFonts } from './fonts/index.js';
import type { AgtkImages } from './images/index.js';
import type { AgtkLayers } from './layers/index.js';
import type { AgtkMovies } from './movies/index.js';
import type { AgtkObjectInstances } from './object-instances/index.js';
import type { AgtkObjects } from './objects/index.js';
import type { AgtkPlayerCharacters } from './player-characters/index.js';
import type { AgtkPlugins } from './plugins/index.js';
import type { AgtkPortals } from './portals/index.js';
import type { AgtkSceneInstances } from './scene-instances/index.js';
import type { AgtkScenes } from './scenes/index.js';
import type { AgtkSES } from './ses/index.js';
import type { AgtkSettings } from './settings/index.js';
import type { AgtkSwitches } from './switches/index.js';
import type { AgtkTexts } from './texts/index.js';
import type { AgtkTilesets } from './tilesets/index.js';
import type { AgtkUi } from './ui/index.js';
import type { AgtkVariables } from './variables/index.js';
import type { AgtkVoices } from './voices/index.js';
/**
 * Agtk interface.
 */
export interface Agtk {
    /**
     * Text string that displays execution engine version.
     *
     * ```
     * Notes:
     * PGMMV `<Version Number>`
     * player `<Version Number>`
     * runtime `<Version Number>`
     * ```
     */
    readonly version: string;
    /**
     * Outputs log.
     *
     * In the player, it is output in the "Runtime Log Console".
     *
     * @param message - Output string.
     */
    log(message: string): void;
    /**
     * Resets the game. Performs same operation as resetting with F5 key.
     */
    reset(): void;
    /**
     * Settings.
     */
    readonly settings: AgtkSettings;
    /**
     * Player characters.
     */
    readonly playerCharacters: AgtkPlayerCharacters;
    /**
     * Scenes.
     */
    readonly scenes: AgtkScenes;
    /**
     * Layers.
     */
    readonly layers: AgtkLayers;
    /**
     * UI.
     */
    readonly ui: AgtkUi;
    /**
     * Scene instances.
     */
    readonly sceneInstances: AgtkSceneInstances;
    /**
     * Plugins.
     */
    readonly plugins: AgtkPlugins;
    /**
     * Objects.
     */
    readonly objects: AgtkObjects;
    /**
     * Animations.
     */
    readonly animations: AgtkAnimations;
    /**
     * Images.
     */
    readonly images: AgtkImages;
    /**
     * Tilesets.
     */
    readonly tilesets: AgtkTilesets;
    /**
     * Common switches.
     */
    readonly switches: AgtkSwitches;
    /**
     * Common variables.
     */
    readonly variables: AgtkVariables;
    /**
     * Action commands.
     */
    readonly actionCommands: AgtkActionCommands;
    /**
     * Portals.
     */
    readonly portals: AgtkPortals;
    /**
     * Controllers.
     */
    readonly controllers: AgtkControllers;
    /**
     * Object instances.
     */
    readonly objectInstances: AgtkObjectInstances;
    /**
     * Fonts.
     */
    readonly fonts: AgtkFonts;
    /**
     * Texts.
     */
    readonly texts: AgtkTexts;
    /**
     * Movies.
     */
    readonly movies: AgtkMovies;
    /**
     * Background music.
     */
    readonly bgms: AgtkBGMS;
    /**
     * Sound effects.
     */
    readonly ses: AgtkSES;
    /**
     * Voices.
     */
    readonly voices: AgtkVoices;
    /**
     * Databases.
     */
    readonly databases: AgtkDatabases;
    /**
     * Constants.
     */
    readonly constants: AgtkConstants;
}
