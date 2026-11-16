/**
 * Agtk plugin custom ID UI parameter interface module.
 *
 * @packageDocumentation
 */
import type { AgtkBaseParameter } from '../base-parameter.interface.js';
import type { AgtkParameterType } from '../parameter-type.enum.js';
import type { AgtkCustomIdParameterParameter } from './custom-id-parameter-parameter.interface.js';
/**
 * Agtk plugin custom ID UI parameter interface.
 */
export interface AgtkCustomIdParameter extends AgtkBaseParameter {
    type: AgtkParameterType.CustomId | `${AgtkParameterType.CustomId}`;
    customParam: AgtkCustomIdParameterParameter[];
    defaultValue: number;
}
