/**
 * Agtk plugin JSON UI parameter interface module.
 *
 * @packageDocumentation
 */
import type { JsonValue } from 'type-fest' with { 'resolution-mode': 'import' };
import type { AgtkBaseParameter } from './base-parameter.interface.js';
import type { AgtkParameterType } from './parameter-type.enum.js';
/**
 * Agtk plugin JSON UI parameter interface.
 */
export interface AgtkJsonParameter extends AgtkBaseParameter {
    type: AgtkParameterType.Json | `${AgtkParameterType.Json}`;
    defaultValue: JsonValue;
}
