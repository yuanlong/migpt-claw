import type { OpenClawConfig } from 'openclaw/plugin-sdk';
import type { MiServiceConfig } from './service.js';
import { DEFAULT_ACCOUNT_ID } from 'openclaw/plugin-sdk';

/**
 * 小米音箱 Channel 配置
 */
export interface MiGPTConfig extends MiServiceConfig {
  /** 启用频道 */
  enabled?: boolean;
  /** 默认账户 ID */
  defaultAccount?: string;
  /** 设备访问策略：pairing/allowlist/open */
  devicePolicy?: 'pairing' | 'allowlist' | 'open';
  /** 允许的设备名称白名单 */
  allowFrom?: Array<string | number>;
  /** 启用流式 TTS */
  streaming?: boolean;
  /** TTS 文本分块长度（汉字） */
  textChunkLimit?: number;
  /** TTS 语速（0.5-2.0） */
  ttsSpeed?: number;
  /** 默认音量（6-100） */
  volume?: number;
  /** 消息轮询间隔（毫秒） */
  heartbeat?: number;
  /** 设备名称列表 */
  devices?: string[];
  /** 账户配置 */
  accounts?: Record<string, MiGPTAccountConfig>;
  /** 音箱控制方式：mina/miot */
  speakerControl?: 'mina' | 'miot';
  /** 系统提示词：用于定制 AI 在音箱场景下的行为规范 */
  systemPrompt?: string;
  /** 启动时是否播报上线文案 */
  announceOnStart?: boolean;
  /** 上线播报文案 */
  startupMessage?: string;
  /** 收到消息时是否回复收到 */
  acknowledgeOnReceive?: boolean;
  /** 收到消息回复文案 */
  receiveMessage?: string;
}

/**
 * 账户配置
 */
export interface MiGPTAccountConfig extends MiServiceConfig {
  /** 启用账户 */
  enabled?: boolean;
  /** 账户名称 */
  name?: string;
  /** 设备名称列表 */
  devices?: string[];
  /** 系统提示词：用于定制 AI 在音箱场景下的行为规范 */
  systemPrompt?: string;
  /** 启动时是否播报上线文案 */
  announceOnStart?: boolean;
  /** 上线播报文案 */
  startupMessage?: string;
  /** 收到消息时是否回复收到 */
  acknowledgeOnReceive?: boolean;
  /** 收到消息回复文案 */
  receiveMessage?: string;
}

/**
 * 解析后的账户信息
 */
export interface ResolvedMiAccount {
  /** 账户 ID */
  accountId: string;
  /** 启用状态 */
  enabled: boolean;
  /** 是否已配置 */
  configured: boolean;
  /** 账户名称 */
  name?: string;
  /** 设备列表 */
  devices: string[];
  /** 配置详情 */
  config: MiGPTAccountConfig;
}

/**
 * OpenClaw 配置类型扩展
 */
export interface ExtendedOpenClawConfig extends OpenClawConfig {
  channels?: {
    migpt?: MiGPTConfig;
  };
}

/**
 * 列出所有账户 ID
 */
export function listMiAccountIds(cfg: ExtendedOpenClawConfig): string[] {
  const migptCfg = cfg.channels?.migpt;
  if (!migptCfg?.accounts) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return [DEFAULT_ACCOUNT_ID, ...Object.keys(migptCfg.accounts)];
}

/**
 * 解析账户配置
 */
export function resolveMiAccount(
  cfg: ExtendedOpenClawConfig,
  accountId?: string,
): ResolvedMiAccount {
  const id = accountId ?? DEFAULT_ACCOUNT_ID;
  const migptCfg = cfg.channels?.migpt;
  const isDefault = id === DEFAULT_ACCOUNT_ID;

  // 获取账户特定配置
  const accountConfig = isDefault
    ? { ...migptCfg }
    : migptCfg?.accounts?.[id] ?? {};

  // 合并全局和账户特定配置
  const mergedConfig: MiGPTAccountConfig = {
    enabled: isDefault ? migptCfg?.enabled : accountConfig.enabled,
    userId: accountConfig.userId ?? migptCfg?.userId,
    password: accountConfig.password ?? migptCfg?.password,
    passToken: accountConfig.passToken ?? migptCfg?.passToken,
    debug: accountConfig.debug ?? migptCfg?.debug,
    timeout: accountConfig.timeout ?? migptCfg?.timeout,
    devices: accountConfig.devices ?? migptCfg?.devices ?? [],
    speakerControl: accountConfig.speakerControl ?? migptCfg?.speakerControl,
  };

  // 检查是否已配置
  const configured = !!(
    mergedConfig.userId &&
    (mergedConfig.passToken || mergedConfig.password)
  );

  return {
    accountId: id,
    enabled: mergedConfig.enabled ?? false,
    configured,
    name: accountConfig.name ?? (isDefault ? 'Default' : id),
    devices: mergedConfig.devices ?? [],
    config: mergedConfig,
  };
}

/**
 * 获取默认账户 ID
 */
export function resolveDefaultMiAccountId(cfg: ExtendedOpenClawConfig): string {
  return cfg.channels?.migpt?.defaultAccount ?? DEFAULT_ACCOUNT_ID;
}

/**
 * 应用账户配置
 */
export function applyMiAccountConfig(
  cfg: ExtendedOpenClawConfig,
  accountId: string,
  updates: Partial<MiGPTAccountConfig>,
): ExtendedOpenClawConfig {
  const isDefault = accountId === DEFAULT_ACCOUNT_ID;
  const migptCfg = cfg.channels?.migpt ?? {};

  if (isDefault) {
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        migpt: {
          ...migptCfg,
          ...updates,
        },
      },
    };
  }

  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      migpt: {
        ...migptCfg,
        accounts: {
          ...migptCfg.accounts,
          [accountId]: {
            ...migptCfg.accounts?.[accountId],
            ...updates,
          },
        },
      },
    },
  };
}

/**
 * 设置账户启用状态
 */
export function setMiAccountEnabled(
  cfg: ExtendedOpenClawConfig,
  accountId: string,
  enabled: boolean,
): ExtendedOpenClawConfig {
  const isDefault = accountId === DEFAULT_ACCOUNT_ID;
  const migptCfg = cfg.channels?.migpt ?? {};

  if (isDefault) {
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        migpt: {
          ...migptCfg,
          enabled,
        },
      },
    };
  }

  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      migpt: {
        ...migptCfg,
        accounts: {
          ...migptCfg.accounts,
          [accountId]: {
            ...migptCfg.accounts?.[accountId],
            enabled,
          },
        },
      },
    },
  };
}

/**
 * 删除账户
 */
export function deleteMiAccount(
  cfg: ExtendedOpenClawConfig,
  accountId: string,
): ExtendedOpenClawConfig {
  const isDefault = accountId === DEFAULT_ACCOUNT_ID;
  const migptCfg = cfg.channels?.migpt;

  if (isDefault) {
    // 删除整个 migpt 配置
    const next = { ...cfg } as ExtendedOpenClawConfig;
    const nextChannels = { ...cfg.channels };
    delete (nextChannels as Record<string, unknown>).migpt;
    if (Object.keys(nextChannels).length > 0) {
      next.channels = nextChannels;
    } else {
      delete next.channels;
    }
    return next;
  }

  // 删除特定账户
  const accounts = { ...migptCfg?.accounts };
  delete accounts[accountId];

  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      migpt: {
        ...migptCfg,
        accounts: Object.keys(accounts).length > 0 ? accounts : undefined,
      },
    },
  };
}

/**
 * 解析允许的设备列表
 */
export function resolveMiAllowFrom(
  cfg: ExtendedOpenClawConfig,
  _accountId?: string,
): string[] {
  const migptCfg = cfg.channels?.migpt;
  const allowFrom = migptCfg?.allowFrom ?? [];
  return allowFrom.map((entry) => String(entry).trim()).filter(Boolean);
}

/**
 * 格式化允许的设备列表
 */
export function formatMiAllowFrom(allowFrom: Array<string | number>): string[] {
  return allowFrom
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .map((entry) => entry.toLowerCase());
}
