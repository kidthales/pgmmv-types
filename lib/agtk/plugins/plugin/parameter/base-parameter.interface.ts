/**
 * Agtk plugin base UI parameter interface module.
 *
 * @packageDocumentation
 * @internal
 */
import type { AgtkParameterTypeValue } from './parameter-type.enum';

/**
 * Agtk plugin base UI parameter interface.
 *
 * @internal
 */
export interface AgtkBaseParameter {
  /**
   * Parameter ID.
   */
  id: number;

  /**
   * Parameter name.
   */
  name: string;

  /**
   * Parameter type.
   */
  type: AgtkParameterTypeValue;

  /**
   * Parameter default value.
   */
  defaultValue?: unknown;
}
