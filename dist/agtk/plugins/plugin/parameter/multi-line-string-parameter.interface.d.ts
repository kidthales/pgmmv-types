/**
 * Agtk plugin multi-line string UI parameter interface module.
 *
 * @packageDocumentation
 */
import type { AgtkBaseStringParameter } from './base-string-parameter.interface.js';
import type { AgtkParameterType } from './parameter-type.enum.js';
/**
 * Agtk plugin multi-line string UI parameter interface.
 */
export interface AgtkMultiLineStringParameter extends AgtkBaseStringParameter {
    type: AgtkParameterType.MultiLineString | `${AgtkParameterType.MultiLineString}`;
}
