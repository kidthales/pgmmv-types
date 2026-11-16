/**
 * Agtk plugin object ID UI parameter interface module.
 *
 * @packageDocumentation
 */
import type { AgtkBaseResourceIdParameter } from './base-resource-id-parameter.interface.js';
import type { AgtkParameterType } from './parameter-type.enum.js';
/**
 * Agtk plugin object ID UI parameter interface.
 */
export interface AgtkObjectIdParameter extends AgtkBaseResourceIdParameter {
    type: AgtkParameterType.ObjectId | `${AgtkParameterType.ObjectId}`;
}
