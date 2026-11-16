/**
 * Agtk plugin font ID UI parameter interface module.
 *
 * @packageDocumentation
 */
import type { AgtkBaseResourceIdParameter } from './base-resource-id-parameter.interface.js';
import type { AgtkParameterType } from './parameter-type.enum.js';
/**
 * Agtk plugin font ID UI parameter interface.
 */
export interface AgtkFontIdParameter extends AgtkBaseResourceIdParameter {
    type: AgtkParameterType.FontId | `${AgtkParameterType.FontId}`;
}
