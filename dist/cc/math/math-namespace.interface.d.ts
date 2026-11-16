/**
 * Cocos math namespace interface module.
 *
 * @packageDocumentation
 */
import type { CCAABBConstructor } from './aabb-constructor.interface.js';
import type { CCAABB } from './aabb.interface.js';
import type { CCOBBConstructor } from './obb-constructor.interface.js';
import type { CCOBB } from './obb.interface.js';
import type { CCQuaternionConstructor } from './quaternion-constructor.interface.js';
import type { CCQuaternion } from './quaternion.interface.js';
import type { CCRayConstructor } from './ray-constructor.interface.js';
import type { CCRay } from './ray.interface.js';
import type { CCVec3Constructor } from './vec-3-constructor.interface.js';
import type { CCVec3 } from './vec-3.interface.js';
import type { CCVec4Constructor } from './vec-4-constructor.interface.js';
import type { CCVec4 } from './vec-4.interface.js';
/**
 * Cocos math namespace interface.
 */
export interface CCMathNamespace {
    /**
     * Vector 3.
     */
    Vec3: CCVec3Constructor;
    /**
     * Create vector 3 instance.
     *
     * @param x
     * @param y
     * @param z
     */
    vec3(x: number, y: number, z: number): CCVec3;
    /**
     * Create vector 3 cross product.
     *
     * @param v1
     * @param v2
     */
    vec3Cross(v1: CCVec3, v2: CCVec3): CCVec3;
    /**
     * Get vector 3 dot product.
     *
     * @param v1
     * @param v2
     */
    vec3Dot(v1: CCVec3, v2: CCVec3): number;
    /**
     * Get vector 3 length.
     *
     * @param v
     */
    vec3Length(v: CCVec3): number;
    /**
     * Create normalized vector 3.
     *
     * @param v
     */
    vec3Normalize(v: CCVec3): CCVec3;
    /**
     * Create summed vector 3.
     *
     * @param v1
     * @param v2
     */
    vec3Add(v1: CCVec3, v2: CCVec3): CCVec3;
    /**
     * Create subtracted vector 3.
     *
     * @param v1
     * @param v2
     */
    vec3Sub(v1: CCVec3, v2: CCVec3): CCVec3;
    /**
     * Quaternion.
     */
    Quaternion: CCQuaternionConstructor;
    /**
     * Create quaternion instance.
     *
     * @param xOrAxis
     * @param yOrAngle
     * @param z
     * @param w
     */
    quaternion(xOrAxis: number | CCVec3, yOrAngle: number, z: number, w?: number): CCQuaternion;
    /**
     * AABB.
     */
    AABB: CCAABBConstructor;
    /**
     * Create AABB instance.
     *
     * @param min
     * @param max
     */
    aabb(min: CCVec3, max: CCVec3): CCAABB;
    /**
     * Get AABB corners.
     *
     * @param aabb
     */
    aabbGetCorners(aabb: CCAABB): [CCVec3, CCVec3, CCVec3, CCVec3, CCVec3, CCVec3, CCVec3, CCVec3];
    /**
     * OBB.
     */
    OBB: CCOBBConstructor;
    /**
     * Create OBB instance.
     *
     * @param aabb
     */
    obb(aabb: CCAABB): CCOBB;
    /**
     * Ray.
     */
    Ray: CCRayConstructor;
    /**
     * Create ray instance.
     *
     * @param origin
     * @param direction
     */
    ray(origin: CCVec3, direction: CCVec3): CCRay;
    /**
     * Vector 4.
     */
    Vec4: CCVec4Constructor;
    /**
     * Create vector 4 instance.
     *
     * @param x
     * @param y
     * @param z
     * @param w
     */
    vec4(x: number, y: number, z: number, w: number): CCVec4;
}
