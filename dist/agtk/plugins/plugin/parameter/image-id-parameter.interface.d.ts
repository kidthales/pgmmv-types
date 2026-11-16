/**
 * Agtk plugin image ID UI parameter interface module.
 *
 * @packageDocumentation
 */
import type { AgtkBaseResourceIdParameter } from './base-resource-id-parameter.interface.js';
import type { AgtkParameterType } from './parameter-type.enum.js';
/**
 * Agtk plugin image ID UI parameter interface.
 */
export interface AgtkImageIdParameter extends AgtkBaseResourceIdParameter {
    type: AgtkParameterType.ImageId | `${AgtkParameterType.ImageId}`;
}
