/**
 * Cocos async namespace interface module.
 *
 * @packageDocumentation
 */
import type { CCAsyncPool } from '../async-pool';

/**
 * Cocos async namespace interface.
 */
export interface CCAsyncNamespace {
  /**
   * Do tasks series.
   *
   * @param tasks
   * @param cb
   * @param target
   */
  series(tasks: object | Array<unknown>, cb: Function, target?: object): CCAsyncPool;

  /**
   * Do tasks parallel.
   *
   * @param tasks
   * @param cb
   * @param target
   */
  parallel(tasks: object | Array<unknown>, cb: Function, target?: object): CCAsyncPool;

  /**
   * Do tasks waterfall.
   * @param tasks
   * @param cb
   * @param target
   */
  waterfall(tasks: object | Array<unknown>, cb: Function, target?: object): CCAsyncPool;

  /**
   * Do tasks by iterator.
   * @param tasks
   * @param iterator
   * @param callback
   * @param target
   */
  map(tasks: object | Array<unknown>, iterator: Function | object, callback?: Function, target?: object): CCAsyncPool;

  /**
   * Do tasks by iterator limit.
   *
   * @param tasks
   * @param limit
   * @param iterator
   * @param cb
   * @param target
   */
  mapLimit(
    tasks: object | Array<unknown>,
    limit: number,
    iterator: Function,
    cb: Function,
    target?: object
  ): CCAsyncPool;
}
