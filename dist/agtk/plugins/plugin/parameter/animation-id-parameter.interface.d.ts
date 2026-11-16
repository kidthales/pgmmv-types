/**
 * Agtk plugin animation ID UI parameter interface module.
 *
 * @packageDocumentation
 */
import type { AgtkBaseResourceIdParameter } from './base-resource-id-parameter.interface.js';
import type { AgtkParameterType } from './parameter-type.enum.js';
/**
 * Agtk plugin animation ID UI parameter interface.
 */
export interface AgtkAnimationIdParameter extends AgtkBaseResourceIdParameter {
    type: AgtkParameterType.AnimationId | `${AgtkParameterType.AnimationId}`;
}
