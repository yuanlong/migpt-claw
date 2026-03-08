/**
 * 调试工具
 */
export class Debugger {
  static debug = false;

  static log(...args: any[]) {
    if (this.debug) {
      console.log('[MiGPT]', ...args);
    }
  }

  static error(...args: any[]) {
    console.error('[MiGPT]', ...args);
  }
}
