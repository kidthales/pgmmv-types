/**
 * Agtk plugin number UI parameter interface module.
 *
 * @packageDocumentation
 */
import type { AgtkBaseParameter } from './base-parameter.interface.js';
import type { AgtkParameterType } from './parameter-type.enum.js';
/**
 * Agtk plugin number UI parameter interface.
 */
export interface AgtkNumberParameter extends AgtkBaseParameter {
    type: AgtkParameterType.Number | `${AgtkParameterType.Number}`;
    defaultValue: number;
    decimals?: number;
    minimumValue?: number;
    maximumValue?: number;
}
