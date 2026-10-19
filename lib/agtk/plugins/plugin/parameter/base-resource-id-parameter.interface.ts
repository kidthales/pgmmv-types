/**
 * Agtk plugin base resource ID UI parameter interface module.
 *
 * @packageDocumentation
 */
import type { AgtkBaseParameter } from './base-parameter.interface';
import type { AgtkParameterType } from './parameter-type.enum';

/**
 * Agtk plugin base resource ID UI parameter interface.
 */
export interface AgtkBaseResourceIdParameter extends AgtkBaseParameter {
  type:
    | AgtkParameterType.ImageId
    | `${AgtkParameterType.ImageId}`
    | AgtkParameterType.TextId
    | `${AgtkParameterType.TextId}`
    | AgtkParameterType.SceneId
    | `${AgtkParameterType.SceneId}`
    | AgtkParameterType.TilesetId
    | `${AgtkParameterType.TilesetId}`
    | AgtkParameterType.AnimationId
    | `${AgtkParameterType.AnimationId}`
    | AgtkParameterType.ObjectId
    | `${AgtkParameterType.ObjectId}`
    | AgtkParameterType.FontId
    | `${AgtkParameterType.FontId}`
    | AgtkParameterType.MovieId
    | `${AgtkParameterType.MovieId}`
    | AgtkParameterType.BgmId
    | `${AgtkParameterType.BgmId}`
    | AgtkParameterType.SeId
    | `${AgtkParameterType.SeId}`
    | AgtkParameterType.VoiceId
    | `${AgtkParameterType.VoiceId}`
    | AgtkParameterType.AnimOnlyId
    | `${AgtkParameterType.AnimOnlyId}`
    | AgtkParameterType.PortalId
    | `${AgtkParameterType.PortalId}`
    | AgtkParameterType.DatabaseId
    | `${AgtkParameterType.DatabaseId}`
    | AgtkParameterType.SwitchId
    | `${AgtkParameterType.SwitchId}`
    | AgtkParameterType.VariableId
    | `${AgtkParameterType.VariableId}`
    | AgtkParameterType.SwitchVariableObjectId
    | `${AgtkParameterType.SwitchVariableObjectId}`;
  defaultValue: -1;
}
