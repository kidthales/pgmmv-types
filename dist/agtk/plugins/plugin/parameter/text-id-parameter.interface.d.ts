/**
 * Agtk plugin text ID UI parameter interface module.
 *
 * @packageDocumentation
 */
import type { AgtkBaseResourceIdParameter } from './base-resource-id-parameter.interface.js';
import type { AgtkParameterType } from './parameter-type.enum.js';
/**
 * Agtk plugin text ID UI parameter interface.
 */
export interface AgtkTextIdParameter extends AgtkBaseResourceIdParameter {
    type: AgtkParameterType.TextId | `${AgtkParameterType.TextId}`;
}
