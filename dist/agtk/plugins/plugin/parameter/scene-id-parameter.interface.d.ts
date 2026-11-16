/**
 * Agtk plugin scene ID UI parameter interface module.
 *
 * @packageDocumentation
 */
import type { AgtkBaseResourceIdParameter } from './base-resource-id-parameter.interface.js';
import type { AgtkParameterType } from './parameter-type.enum.js';
/**
 * Agtk plugin scene ID UI parameter interface.
 */
export interface AgtkSceneIdParameter extends AgtkBaseResourceIdParameter {
    type: AgtkParameterType.SceneId | `${AgtkParameterType.SceneId}`;
}
