/**
 * Cocos v3f c4b t2f interface module.
 *
 * @packageDocumentation
 */
import type { CCColor } from '../color/index.js';
import type { CCTex2F } from '../tex-2f/index.js';
import type { CCVertex3F } from '../vertex-3f/index.js';
/**
 * Cocos v3f c4b t2f interface.
 */
export interface CCV3F_C4B_T2F {
    vertices: CCVertex3F;
    colors: CCColor;
    texCoords: CCTex2F;
}
