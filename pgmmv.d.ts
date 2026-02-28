import type { Agtk, cc, jsb } from './lib';

declare global {
  /**
   * Agtk namespace.
   */
  const Agtk: Agtk;

  /**
   * Cocos namespace.
   */
  const cc: cc;

  /**
   * Cocos JSB namespace.
   */
  const jsb: jsb;
}
