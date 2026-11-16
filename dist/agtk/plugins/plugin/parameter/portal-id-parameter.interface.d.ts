/**
 * Agtk plugin portal ID UI parameter interface module.
 *
 * @packageDocumentation
 */
import type { AgtkBaseResourceIdParameter } from './base-resource-id-parameter.interface.js';
import type { AgtkParameterType } from './parameter-type.enum.js';
/**
 * Agtk plugin portal ID UI parameter interface.
 */
export interface AgtkPortalIdParameter extends AgtkBaseResourceIdParameter {
    type: AgtkParameterType.PortalId | `${AgtkParameterType.PortalId}`;
}
