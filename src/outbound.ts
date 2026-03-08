import type { ChannelOutboundAdapter } from 'openclaw/plugin-sdk';
import { MiService } from './service.js';
import { MiSpeaker } from './speaker.js';
import { resolveMiAccount } from './config.js';
import type { ExtendedOpenClawConfig } from './types.js';

/**
 * 文本分块函数
 */
function chunkText(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  
  const chunks: string[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }
    
    // 尝试在换行处分割
    let splitAt = remaining.lastIndexOf('\n', limit);
    if (splitAt <= 0 || splitAt < limit * 0.5) {
      // 没找到合适的换行，尝试在空格处分割
      splitAt = remaining.lastIndexOf(' ', limit);
    }
    if (splitAt <= 0 || splitAt < limit * 0.5) {
      // 还是没找到，强制在 limit 处分割
      splitAt = limit;
    }
    
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  
  return chunks;
}

export const miOutbound: ChannelOutboundAdapter = {
  deliveryMode: 'direct',
  chunker: chunkText,
  chunkerMode: 'plain',
  textChunkLimit: 200,
  
  sendText: async ({ to, text, accountId, cfg }) => {
    const account = resolveMiAccount(cfg as unknown as ExtendedOpenClawConfig, accountId);
    
    if (!account.configured) {
      return { 
        channel: 'migpt', 
        error: new Error('Account not configured') 
      };
    }

    // 初始化服务
    const initSuccess = await MiService.init(account.config, to);
    if (!initSuccess) {
      return { 
        channel: 'migpt', 
        error: new Error('Failed to initialize MiService') 
      };
    }

    // 设置音量（如果配置了）
    const volume = cfg.channels?.migpt?.volume;
    if (volume && volume >= 6 && volume <= 100) {
      await MiSpeaker.setVolume(volume);
    }

    // 分块发送（如果启用流式）
    const streaming = cfg.channels?.migpt?.streaming ?? true;
    const chunkLimit = cfg.channels?.migpt?.textChunkLimit ?? 200;
    
    if (streaming && text.length > chunkLimit) {
      const chunks = chunkText(text, chunkLimit);
      for (const chunk of chunks) {
        const result = await MiSpeaker.play({ text: chunk });
        if (!result.success) {
          return { 
            channel: 'migpt', 
            error: new Error(result.error) 
          };
        }
        // 小块之间短暂暂停，避免过于紧凑
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      return { channel: 'migpt', messageId: Date.now().toString() };
    } else {
      const result = await MiSpeaker.play({ text });
      if (!result.success) {
        return { 
          channel: 'migpt', 
          error: new Error(result.error) 
        };
      }
      return { channel: 'migpt', messageId: Date.now().toString() };
    }
  },
  
  sendMedia: async ({ to, text, mediaUrl, accountId, cfg }) => {
    const account = resolveMiAccount(cfg as unknown as ExtendedOpenClawConfig, accountId);
    
    if (!account.configured) {
      return { 
        channel: 'migpt', 
        error: new Error('Account not configured') 
      };
    }

    const initSuccess = await MiService.init(account.config, to);
    if (!initSuccess) {
      return { 
        channel: 'migpt', 
        error: new Error('Failed to initialize MiService') 
      };
    }

    // 发送文本说明（如果有）
    if (text?.trim()) {
      await MiSpeaker.play({ text });
    }

    // 播放音频 URL
    if (mediaUrl) {
      const result = await MiSpeaker.play({ url: mediaUrl });
      if (!result.success) {
        return { 
          channel: 'migpt', 
          error: new Error(result.error) 
        };
      }
    }

    return { channel: 'migpt', messageId: Date.now().toString() };
  },
};
