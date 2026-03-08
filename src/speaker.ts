import { MiService } from './service.js';

export interface IPlayOptions {
  text?: string;
  url?: string;
}

export interface IPlayResult {
  success: boolean;
  error?: string;
}

class _MiSpeaker {
  /**
   * 播放文字、音频链接
   */
  async play(options: IPlayOptions): Promise<IPlayResult> {
    const { text, url } = options;

    if (!MiService.MiNA && !MiService.MiOT) {
      return { success: false, error: 'MiNA/MiOT service not initialized' };
    }

    try {
      let result: boolean;
      if (url) {
        // URL 播放只支持 MiNA
        if (!MiService.MiNA) {
          return { success: false, error: 'MiNA service not initialized for URL playback' };
        }
        result = await MiService.MiNA.play({ url });
      } else if (text) {
        // 文字播报使用配置的播放方式
        result = await MiService.play(text);
      } else {
        return { success: false, error: 'text or url is required' };
      }

      if (result) {
        return { success: true };
      } else {
        return { success: false, error: 'Playback failed' };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * 设置音量
   */
  async setVolume(volume: number): Promise<IPlayResult> {
    if (!MiService.MiNA && !MiService.MiOT) {
      return { success: false, error: 'MiNA/MiOT service not initialized' };
    }

    try {
      // 音量控制只支持 MiNA
      if (MiService.MiNA) {
        const result = await MiService.MiNA.setVolume(volume);
        if (result) {
          return { success: true };
        } else {
          return { success: false, error: 'Failed to set volume' };
        }
      } else {
        return { success: false, error: 'MiNA service required for volume control' };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * 获取音量
   */
  async getVolume(): Promise<number | undefined> {
    if (!MiService.MiNA) {
      return undefined;
    }

    try {
      return await MiService.MiNA.getVolume();
    } catch {
      return undefined;
    }
  }

  /**
   * 暂停播放
   */
  async pause(): Promise<IPlayResult> {
    if (!MiService.MiNA && !MiService.MiOT) {
      return { success: false, error: 'MiNA/MiOT service not initialized' };
    }

    try {
      // 暂停只支持 MiNA
      if (MiService.MiNA) {
        const result = await MiService.MiNA.pause();
        return { success: result };
      } else {
        return { success: false, error: 'MiNA service required for pause' };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * 停止播放
   */
  async stop(): Promise<IPlayResult> {
    if (!MiService.MiNA && !MiService.MiOT) {
      return { success: false, error: 'MiNA/MiOT service not initialized' };
    }

    try {
      // 停止只支持 MiNA
      if (MiService.MiNA) {
        const result = await MiService.MiNA.stop();
        return { success: result };
      } else {
        return { success: false, error: 'MiNA service required for stop' };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * 播放或暂停
   */
  async playOrPause(): Promise<IPlayResult> {
    if (!MiService.MiNA && !MiService.MiOT) {
      return { success: false, error: 'MiNA/MiOT service not initialized' };
    }

    try {
      // 播放或暂停只支持 MiNA
      if (MiService.MiNA) {
        const result = await MiService.MiNA.playOrPause();
        return { success: result };
      } else {
        return { success: false, error: 'MiNA service required for playOrPause' };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * 中断小爱音箱的运行（重启设备）
   * 注意：重启需要大约 1-2s 的时间，在此期间无法使用小爱音箱自带的 TTS 服务
   */
  async abortXiaoAI(): Promise<boolean> {
    // 无法通过 MiOT 中断小爱运行
    // 可以通过 MiOT 重启设备，但这会影响所有功能
    return false;
  }
}

export const MiSpeaker = new _MiSpeaker();
