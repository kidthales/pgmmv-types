/**
 * Agtk action commands constants interface module.
 *
 * @packageDocumentation
 */
import type { AgtkAttackSetting } from './attack-setting/index.js';
import type { AgtkCommandBehavior } from './command-behavior/index.js';
import type { AgtkDirectionMove } from './direction-move/index.js';
import type { AgtkEffectRemove } from './effect-remove/index.js';
import type { AgtkEffectShow } from './effect-show/index.js';
import type { AgtkFileLoad } from './file-load/index.js';
import type { AgtkForthBackMoveTurn } from './forth-back-move-turn/index.js';
import type { AgtkGameSpeedChange } from './game-speed-change/index.js';
import type { AgtkImageShow } from './image-show/index.js';
import type { AgtkMenuHide } from './menu-hide/index.js';
import type { AgtkMenuShow } from './menu-show/index.js';
import type { AgtkMessageShow } from './message-show/index.js';
import type { AgtkMovieShow } from './movie-show/index.js';
import type { AgtkObjectChange } from './object-change/index.js';
import type { AgtkObjectCreate } from './object-create/index.js';
import type { AgtkObjectLock } from './object-lock/index.js';
import type { AgtkObjectMove } from './object-move/index.js';
import type { AgtkObjectPushPull } from './object-push-pull/index.js';
import type { AgtkObjectUnlock } from './object-unlock/index.js';
import type { AgtkParticleRemove } from './particle-remove/index.js';
import type { AgtkParticleShow } from './particle-show/index.js';
import type { AgtkPriorityType } from './priority-type/index.js';
import type { AgtkSceneRotateFlip } from './scene-rotate-flip/index.js';
import type { AgtkScrollMessageShow } from './scroll-message-show/index.js';
import type { AgtkSoundPlay } from './sound-play/index.js';
import type { AgtkSoundPositionRemember } from './sound-position-remember/index.js';
import type { AgtkSoundStop } from './sound-stop/index.js';
import type { AgtkTemplateMove } from './template-move/index.js';
import type { AgtkTimer } from './timer/index.js';
/**
 * Agtk action commands constants interface.
 */
export interface AgtkActionCommands {
    /**
     * Object by type.
     */
    readonly ObjectByType: 0;
    /**
     * Object by group.
     */
    readonly ObjectByGroup: 0;
    /**
     * Object by ID.
     */
    readonly ObjectById: 1;
    /**
     * Project common.
     */
    readonly ProjectCommon: 0;
    /**
     * Unset object.
     */
    readonly UnsetObject: -1;
    /**
     * Self object.
     */
    readonly SelfObject: -2;
    /**
     * Other than self object.
     */
    readonly OtherThanSelfObject: -3;
    /**
     * Child object.
     */
    readonly ChildObject: -4;
    /**
     * Locked object.
     */
    readonly LockedObject: -5;
    /**
     * Touched object.
     */
    readonly TouchedObject: -6;
    /**
     * Parent object.
     */
    readonly ParentObject: -7;
    /**
     * According to move direction.
     */
    readonly AccordingToMoveDirection: -2;
    /**
     * Command behavior.
     */
    readonly commandBehavior: AgtkCommandBehavior;
    /**
     * Priority type.
     */
    readonly priorityType: AgtkPriorityType;
    /**
     * Template move.
     */
    readonly templateMove: AgtkTemplateMove;
    /**
     * Object lock.
     */
    readonly objectLock: AgtkObjectLock;
    /**
     * Object create.
     */
    readonly objectCreate: AgtkObjectCreate;
    /**
     * Object change.
     */
    readonly objectChange: AgtkObjectChange;
    /**
     * Object move.
     */
    readonly objectMove: AgtkObjectMove;
    /**
     * Object push pull.
     */
    readonly objectPushPull: AgtkObjectPushPull;
    /**
     * Attack setting.
     */
    readonly attackSetting: AgtkAttackSetting;
    /**
     * Scene rotate flip.
     */
    readonly sceneRotateFlip: AgtkSceneRotateFlip;
    /**
     * Sound play.
     */
    readonly soundPlay: AgtkSoundPlay;
    /**
     * Sound stop.
     */
    readonly soundStop: AgtkSoundStop;
    /**
     * Sound position remember.
     */
    readonly soundPositionRemember: AgtkSoundPositionRemember;
    /**
     * Message show.
     */
    readonly messageShow: AgtkMessageShow;
    /**
     * Scroll message show.
     */
    readonly scrollMessageShow: AgtkScrollMessageShow;
    /**
     * Effect show.
     */
    readonly effectShow: AgtkEffectShow;
    /**
     * Effect remove.
     */
    readonly effectRemove: AgtkEffectRemove;
    /**
     * Particle show.
     */
    readonly particleShow: AgtkParticleShow;
    /**
     * Particle remove.
     */
    readonly particleRemove: AgtkParticleRemove;
    /**
     * Movie show.
     */
    readonly movieShow: AgtkMovieShow;
    /**
     * Image show.
     */
    readonly imageShow: AgtkImageShow;
    /**
     * Game speed change.
     */
    readonly gameSpeedChange: AgtkGameSpeedChange;
    /**
     * Timer.
     */
    readonly timer: AgtkTimer;
    /**
     * Direction move.
     */
    readonly directionMove: AgtkDirectionMove;
    /**
     * Forth back move turn.
     */
    readonly forthBackMoveTurn: AgtkForthBackMoveTurn;
    /**
     * Menu show.
     */
    readonly menuShow: AgtkMenuShow;
    /**
     * Menu hide.
     */
    readonly menuHide: AgtkMenuHide;
    /**
     * File load.
     */
    readonly fileLoad: AgtkFileLoad;
    /**
     * Object unlock.
     */
    readonly objectUnlock: AgtkObjectUnlock;
}
