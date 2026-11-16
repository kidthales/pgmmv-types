/**
 * Agtk plugin movie ID UI parameter interface module.
 *
 * @packageDocumentation
 */
import type { AgtkBaseResourceIdParameter } from './base-resource-id-parameter.interface.js';
import type { AgtkParameterType } from './parameter-type.enum.js';
/**
 * Agtk plugin movie ID UI parameter interface.
 */
export interface AgtkMovieIdParameter extends AgtkBaseResourceIdParameter {
    type: AgtkParameterType.MovieId | `${AgtkParameterType.MovieId}`;
}
