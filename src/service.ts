import { MiNA } from './mi/mina.js';
import { MIoT } from './mi/miot.js';
import { getMiService } from './mi/common.js';
import { assert, sleep } from './utils/parse.js';
import { Debugger } from './utils/debug.js';

export interface MiServiceConfig {
  /** 小米 ID（数字） */
  userId?: string;
  /** 密码 */
  password?: string;
  /** 登录凭证 */
  passToken?: string;
  /** 是否开启调试模式 */
  debug?: boolean;
  /** 网络请求超时时长（毫秒） */
  timeout?: number;
  /** 音箱控制方式：mina/miot */
  speakerControl?: 'mina' | 'miot';
}

class _MiService {
  MiNA?: MiNA;
  MiOT?: MIoT;
  private _initialized = false;
  private _initializing = false;
  private _speakerControl: 'mina' | 'miot' = 'mina';

  /**
   * 使用 MIoT 发送 TTS 播报
   */
  async playWithMiot(text: string): Promise<boolean> {
    if (!this.MiOT) {
      console.warn('⚠️ MIoT 服务不可用');
      return false;
    }
    try {
      // 使用 MIoT spec 调用 TTS 动作 (siid=5, aiid=1 是常见的 TTS 动作)
      // 不同设备可能不同，需要根据设备 spec 调整
      const result = await this.MiOT.doAction(5, 1, [text]);
      return result;
    } catch (e: any) {
      console.error('❌ MIoT TTS 失败:', e?.message || e);
      return false;
    }
  }

  /**
   * 使用 MiNA 发送 TTS 播报
   */
  async playWithMina(text: string): Promise<boolean> {
    if (!this.MiNA) {
      console.warn('⚠️ MiNA 服务不可用');
      return false;
    }
    try {
      const result = await this.MiNA.play({ text });
      return result;
    } catch (e: any) {
      console.error('❌ MiNA TTS 失败:', e?.message || e);
      return false;
    }
  }

  /**
   * 发送 TTS 播报（根据配置选择 MiNA 或 MIoT）
   */
  async play(text: string): Promise<boolean> {
    if (this._speakerControl === 'miot') {
      return this.playWithMiot(text);
    } else {
      return this.playWithMina(text);
    }
  }

  /**
   * 初始化服务
   */
  async init(config: MiServiceConfig & { 
    announceOnStart?: boolean; 
    startupMessage?: string; 
  }, did: string): Promise<boolean> {
    if (this._initialized) {
      console.log('✅ MiService 已初始化，跳过');
      return true;
    }

    if (this._initializing) {
      // 等待初始化完成
      let waitCount = 0;
      while (this._initializing && waitCount < 30) {
        await sleep(100);
        waitCount++;
      }
      return this._initialized;
    }

    this._initializing = true;

    try {
      console.log('🚀 开始初始化 MiService...');
      console.log('📋 配置信息:', {
        did,
        userId: config.userId,
        hasPassword: !!config.password,
        hasPassToken: !!config.passToken,
        debug: config.debug,
        timeout: config.timeout,
        speakerControl:config.speakerControl
      });

      assert(!!did, '❌ Speaker 缺少 did 参数');
      assert(
        !!config.passToken || (!!config.userId && !!config.password),
        '❌ Speaker 缺少 passToken 或 userId 和 password',
      );

      Debugger.debug = config.debug ?? false;
      this._speakerControl = config.speakerControl ?? 'mina';

      const serviceConfig = {
        ...config,
        did,
        timeout: Math.max(1000, config.timeout ?? 5000),
      };

      console.log('🔌 正在连接 MiNA 服务...');
      this.MiNA = (await getMiService({ ...serviceConfig, service: 'mina' })) as MiNA | undefined;
      console.log('🔌 查询 MiNA 服务结果：', { mina: !!this.MiNA });

      // MiOT 对于音箱设备是可选的，只记录警告不阻断
      console.log('🔌 正在连接 MIoT 服务...');
      this.MiOT = (await getMiService({ ...serviceConfig, service: 'miot' })) as MIoT | undefined;
      console.log('🔌 查询 MIoT 服务结果：', { miot: !!this.MiOT });

      // 对于音箱设备，MiNA 是必需的，MiOT 是可选的
      assert(!!this.MiNA, '❌ 初始化 MiNA 服务失败');
      if (!this.MiOT) {
        console.warn('⚠️ MIoT 服务初始化失败，部分设备控制功能可能不可用');
      }

      if (Debugger.debug) {
        const device: any = this.MiNA?.account?.device;
        console.debug(
          '🐛 设备信息：',
          JSON.stringify(
            {
              name: device?.name,
              desc: device?.desc,
              model: device?.model,
              rom: device?.extra?.fw_version,
            },
            null,
            2,
          ),
        );
      }

      this._initialized = true;
      console.log('✅ MiService 初始化成功');
      console.log(`🔊 音箱控制方式：${this._speakerControl}`);

      // 初始化成功后发送 TTS 播报（如果启用了启动播报）
      const announceOnStart = config.announceOnStart ?? true;
      if (announceOnStart) {
        const startupMessage = config.startupMessage ?? '您的小龙虾已上线，随时为您服务';
        try {
          console.log('🔊 正在发送启动播报:', startupMessage);
          await this.play(startupMessage);
          console.log('✅ 启动播报发送成功');
        } catch (e: any) {
          console.warn('⚠️ 启动播报发送失败:', e?.message || e);
        }
      }

      return true;
    } catch (err: any) {
      console.error('❌ 初始化失败:',{err:err,message: err.message});
      return false;
    } finally {
      this._initializing = false;
    }
  }

  /**
   * 获取设备列表
   */
  async getDevices(config: MiServiceConfig): Promise<Array<{ did: string; name: string; model?: string }>> {
    try {
      // 临时初始化以获取设备列表
      const tempService = await getMiService({ ...config, service: 'mina', relogin: false });
      if (!tempService) {
        return [];
      }

      const devices = await (tempService as MiNA).getDevices();
      return (devices || []).map((d: any) => ({
        did: d.name || d.alias || d.deviceID,
        name: d.alias || d.name,
        model: d.model,
      }));
    } catch (err) {
      console.error('❌ 获取设备列表失败:', err);
      return [];
    }
  }

  /**
   * 重新登录
   */
  async relogin(config: MiServiceConfig, did: string): Promise<boolean> {
    this._initialized = false;
    return this.init(config, did);
  }
}

export const MiService = new _MiService();
