/**
 * Agtk plugin string UI parameter interface module.
 *
 * @packageDocumentation
 */
import type { AgtkBaseStringParameter } from './base-string-parameter.interface.js';
import type { AgtkParameterType } from './parameter-type.enum.js';
/**
 * Agtk plugin string UI parameter interface.
 */
export interface AgtkStringParameter extends AgtkBaseStringParameter {
    type: AgtkParameterType.String | `${AgtkParameterType.String}`;
}
