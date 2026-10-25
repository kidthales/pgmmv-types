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

  /**
   * Window interface augmentation for kidthales plugins.
   */
  interface Window {
    kt: any;
  }
}
