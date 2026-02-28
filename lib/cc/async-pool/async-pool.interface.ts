/**
 * Cocos async pool interface module.
 *
 * @packageDocumentation
 */

/**
 * Cocos async pool interface.
 */
export interface CCAsyncPool {
  size: number;
  finishedSize: number;
  onIterator(iterator: Function, target: object): void;
  onEnd(endCb: Function, endCbTarget: object): void;
  flow(): void;
}
