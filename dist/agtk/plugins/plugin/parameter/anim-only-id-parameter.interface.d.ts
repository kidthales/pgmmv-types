/**
 * Agtk plugin animation-only ID UI parameter interface module.
 *
 * @packageDocumentation
 */
import type { AgtkBaseResourceIdParameter } from './base-resource-id-parameter.interface.js';
import type { AgtkParameterType } from './parameter-type.enum.js';
/**
 * Agtk plugin animation-only ID UI parameter interface.
 */
export interface AgtkAnimOnlyIdParameter extends AgtkBaseResourceIdParameter {
    type: AgtkParameterType.AnimOnlyId | `${AgtkParameterType.AnimOnlyId}`;
}
