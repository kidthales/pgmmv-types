/**
 * Agtk object instance variables interface module.
 *
 * @packageDocumentation
 */
import type { ValueAccessorAccessor } from '../../../_shared/value-accessor-accessor.interface.js';
import type { AgtkVariable } from './variable/index.js';
/**
 * Agtk object instance variables interface.
 */
export interface AgtkVariables extends ValueAccessorAccessor<AgtkVariable> {
}
