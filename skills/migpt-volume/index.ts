import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { MiService } from '../../service.js';
import { MiSpeaker } from '../../speaker.js';

/**
 * 音量控制技能
 */
export function registerMigptVolumeSkill(api: OpenClawPluginApi) {
  api.registerTool({
    name: 'set_volume',
    description: '设置小爱音箱的音量',
    inputSchema: {
      type: 'object',
      properties: {
        volume: {
          type: 'number',
          description: '音量大小（6-100）',
          minimum: 6,
          maximum: 100,
        },
      },
      required: ['volume'],
    },
    execute: async (input: { volume: number }) => {
      const result = await MiSpeaker.setVolume(input.volume);
      if (result.success) {
        return { success: true, message: `音量已设置为 ${input.volume}` };
      } else {
        return { success: false, error: result.error };
      }
    },
  });

  api.registerTool({
    name: 'get_volume',
    description: '获取小爱音箱的当前音量',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const volume = await MiSpeaker.getVolume();
      if (volume !== undefined) {
        return { success: true, volume };
      } else {
        return { success: false, error: '获取音量失败' };
      }
    },
  });
}
