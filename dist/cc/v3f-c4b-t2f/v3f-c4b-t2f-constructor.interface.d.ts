/**
 * Cocos v3f c4b t2f constructor interface module.
 *
 * @packageDocumentation
 */
import type { Constructor } from '../../_shared/index.js';
import type { CCColor } from '../color/index.js';
import type { CCTex2F } from '../tex-2f/index.js';
import type { CCVertex3F } from '../vertex-3f/index.js';
import type { CCV3F_C4B_T2F } from './v3f-c4b-t2f.interface.js';
/**
 * Cocos v3f c4b t2f constructor interface.
 *
 * @param vertices
 * @param colors
 * @param texCoords
 * @param arrayBuffer
 * @param offset
 * @constructor
 */
export interface CCV3F_C4B_T2FConstructor<T extends CCV3F_C4B_T2F = CCV3F_C4B_T2F, U extends any[] = [CCVertex3F?, CCColor?, CCTex2F?, ArrayBuffer?, number?]> extends Constructor<T, U> {
    /**
     * @static
     */
    readonly BYTES_PER_ELEMENT: 24;
}
