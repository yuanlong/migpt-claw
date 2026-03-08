import type { ChannelPlugin } from 'openclaw/plugin-sdk';
import { DEFAULT_ACCOUNT_ID } from 'openclaw/plugin-sdk';
import type { ResolvedMiAccount, ExtendedOpenClawConfig } from './types.js';
import {
  resolveMiAccount,
  listMiAccountIds,
  resolveDefaultMiAccountId,
  setMiAccountEnabled,
  deleteMiAccount,
  resolveMiAllowFrom,
  formatMiAllowFrom,
} from './config.js';
import { miOutbound } from './outbound.js';
import { miGPTOnboardingAdapter } from './onboarding.js';
import { MiService } from './service.js';
import { MiMessage } from './message.js';
import { sleep } from './utils/parse.js';
import { Debugger } from './utils/debug.js';
import { MiSpeaker } from './speaker.js';
import { getMiGPTRuntime } from './runtime.js';

const meta = {
  id: 'migpt',
  label: 'MiGPT',
  selectionLabel: '小米音箱 (MiGPT)',
  docsPath: '/channels/migpt',
  docsLabel: 'migpt',
  blurb: '小米小爱音箱语音对话。',
  aliases: ['xiaomi', 'mico'],
  order: 60,
};

export const miGPTPlugin: ChannelPlugin<ResolvedMiAccount> = {
  id: 'migpt',
  meta: {
    ...meta,
  },
  capabilities: {
    chatTypes: ['direct'],
    polls: false,
    threads: false,
    media: true,
    reactions: false,
    edit: false,
    reply: false,
    blockStreaming: false,
  },
  reload: { configPrefixes: ['channels.migpt'] },
  onboarding: miGPTOnboardingAdapter,

  // 新增：Agent Prompt 配置，用于定制 AI 在音箱场景下的行为规范
  agentPrompt: {
    description: '音箱播报规范',
    getConfig: (cfg: any) => {
      const migptCfg = cfg.channels?.migpt;
      return {
        enabled: true,
        systemPrompt: migptCfg?.systemPrompt,
      };
    },
    applyConfig: (cfg: any, updates: any) => {
      const nextCfg = { ...cfg } as ExtendedOpenClawConfig;
      const nextMigpt = { ...nextCfg.channels?.migpt };
      if (updates.systemPrompt !== undefined) {
        nextMigpt.systemPrompt = updates.systemPrompt;
      }
      nextCfg.channels = { ...nextCfg.channels, migpt: nextMigpt };
      return nextCfg;
    },
  },

  config: {
    listAccountIds: (cfg) => listMiAccountIds(cfg as unknown as ExtendedOpenClawConfig),
    resolveAccount: (cfg, accountId) =>
      resolveMiAccount(cfg as unknown as ExtendedOpenClawConfig, accountId),
    defaultAccountId: (cfg) => resolveDefaultMiAccountId(cfg as unknown as ExtendedOpenClawConfig),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setMiAccountEnabled(cfg as unknown as ExtendedOpenClawConfig, accountId, enabled),
    deleteAccount: ({ cfg, accountId }) =>
      deleteMiAccount(cfg as unknown as ExtendedOpenClawConfig, accountId),
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      name: account.name,
      devices: account.devices,
    }),
    resolveAllowFrom: ({ cfg, accountId }: { cfg: any; accountId?: string }) =>
      resolveMiAllowFrom(cfg as unknown as ExtendedOpenClawConfig, accountId),
    formatAllowFrom: ({ allowFrom }: { allowFrom: Array<string | number> }) => formatMiAllowFrom(allowFrom),
  },

  setup: {
    resolveAccountId: ({ accountId }: { accountId?: string }) => accountId?.trim().toLowerCase() || DEFAULT_ACCOUNT_ID,
    applyAccountConfig: ({ cfg, accountId, input }: { cfg: any; accountId?: string; input: any }) => {
      const migptCfg = cfg.channels?.migpt ?? {};
      const accountConfig = {
        userId: input.userId,
        password: input.password,
        passToken: input.passToken,
        devices: input.devices,
        enabled: true,
      };

      const isDefault = !accountId || accountId === DEFAULT_ACCOUNT_ID;

      if (isDefault) {
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            migpt: {
              ...migptCfg,
              ...accountConfig,
            },
          },
        } as ExtendedOpenClawConfig;
      }

      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          migpt: {
            ...migptCfg,
            accounts: {
              ...migptCfg.accounts,
              [accountId]: accountConfig,
            },
          },
        },
      } as ExtendedOpenClawConfig;
    },
    validateInput: ({ input }: { input: any }) => {
      if (!input.userId) {
        return '小米 ID (userId) 是必需的';
      }
      if (!input.passToken && !input.password) {
        return '需要提供 passToken 或 password';
      }
      return null;
    },
  },

  messaging: {
    normalizeTarget: (target: string) => {
      // 支持格式：migpt:客厅音箱 或 客厅音箱
      let id = target.replace(/^migpt:/i, '');
      if (id.trim()) {
        return { ok: true, to: id.trim() };
      }
      return { ok: false, error: 'Invalid target format' };
    },
    targetResolver: {
      looksLikeId: (id: string): boolean => {
        // 简单的启发式判断：非空字符串
        return id.length > 0 && id.length < 100;
      },
      hint: 'MiGPT 目标格式：设备名称（如：客厅音箱）',
    },
  },

  outbound: miOutbound,

  gateway: {
    startAccount: async (ctx) => {
      const { account, abortSignal, log, cfg } = ctx;

      log?.info(`[migpt:${account.accountId}] Starting gateway`);

      if (!account.configured) {
        log?.error(`[migpt:${account.accountId}] Account not configured`);
        return;
      }

      // 获取设备列表
      const devices = account.devices;
      if (devices.length === 0) {
        log?.error(`[migpt:${account.accountId}] No devices configured`);
        return;
      }

      // 为每个设备启动轮询
      const devicePromises = devices.map(async (deviceName: string) => {
        log?.info(`[migpt:${account.accountId}] Starting poller for device: ${deviceName}`);

        // 初始化服务（传递启动播报配置）
        const initSuccess = await MiService.init({
          ...account.config,
          announceOnStart: account.config.announceOnStart ?? cfg.channels?.migpt?.announceOnStart,
          startupMessage: account.config.startupMessage ?? cfg.channels?.migpt?.startupMessage,
        }, deviceName);
        if (!initSuccess) {
          log?.error(`[migpt:${account.accountId}] Failed to initialize device: ${deviceName}`);
          return;
        }

        // 设置调试模式和音箱控制方式
        Debugger.debug = account.config.debug ?? false;

        // 更新状态
        ctx.setStatus({
          ...ctx.getStatus(),
          running: true,
          connected: true,
          lastConnectedAt: Date.now(),
        });

        // 获取轮询间隔
        const heartbeat = cfg.channels?.migpt?.heartbeat ?? 1000;

        // 轮询消息
        while (!abortSignal.aborted) {
          try {
            const msg = await MiMessage.fetchNextMessage(deviceName);
            if (msg) {
              log?.info(`[migpt:${account.accountId}] Received message from ${deviceName}: ${msg.text.slice(0, 50)}...`);

              // ============ 收到消息时回复收到 ============
              const acknowledgeOnReceive = account.config.acknowledgeOnReceive
                ?? cfg.channels?.migpt?.acknowledgeOnReceive ?? false;

              if (acknowledgeOnReceive) {
                const receiveMessage = account.config.receiveMessage
                  ?? cfg.channels?.migpt?.receiveMessage
                  ?? '收到，处理中';

                try {
                  MiSpeaker.abortXiaoAI();
                  MiSpeaker.stop();
                  MiSpeaker.play({ text: receiveMessage });
                } catch (err) {
                  log?.error(`[migpt:${account.accountId}] Failed to play receive message: ${err}`);
                }
              }

              // 记录活动
              const pluginRuntime = getMiGPTRuntime();
              pluginRuntime.channel.activity.record({
                channel: 'migpt',
                accountId: account.accountId,
                direction: 'inbound',
              });

              // 构建路由
              const fromAddress = `migpt:${deviceName}`;
              const toAddress = `migpt:${account.accountId}`;
              const sessionKey = `${account.accountId}:${deviceName}`;

              // ============ 系统提示词注入 ============
              // 收集系统提示词（账户级别 + 全局）
              const systemPrompts: string[] = [];
              
              // 账户级别的 systemPrompt
              if (account.config.systemPrompt) {
                systemPrompts.push(account.config.systemPrompt);
              }
              
              // 全局 systemPrompt
              const globalSystemPrompt = (cfg as any).channels?.migpt?.systemPrompt;
              if (globalSystemPrompt && globalSystemPrompt !== account.config.systemPrompt) {
                systemPrompts.push(globalSystemPrompt);
              }

              // 构建消息体
              const envelopeOptions = pluginRuntime.channel.reply.resolveEnvelopeFormatOptions(cfg);
              const body = pluginRuntime.channel.reply.formatInboundEnvelope({
                Body: msg.text,
                BodyForAgent: msg.text,
                From: fromAddress,
                To: toAddress,
                SessionKey: sessionKey,
                ChatType: 'direct',
                SenderId: deviceName,
                SenderName: deviceName,
                Provider: 'migpt',
                Surface: 'migpt',
                MessageSid: `${deviceName}-${msg.timestamp}`,
                Timestamp: msg.timestamp,
                OriginatingChannel: 'migpt',
                envelopeOptions,
              });

              // 默认的音箱场景提示词（如果没有配置 systemPrompt）
              const DEFAULT_SPEAKER_PROMPT = `【音箱播报规范 - 必须遵守】
你是一个智能音箱助手，通过语音与用户交流。请遵守以下规范：

📢 播报原则：
1. 简短优先：单次播报控制在 100 字以内，超过请拆分或改用其他渠道
2. 纯文字：只输出适合语音播报的纯文字，不要包含 URL、代码、复杂格式
3. 自然口语：使用简短、清晰的口语表达，避免长句和复杂结构

🚫 不适合播报的内容（应改用其他渠道）：
- 代码片段、技术文档
- 长篇文章、报告（>300 字）
- 复杂数据表格、列表
- 图片、视频、文件等多媒体内容
- URL 链接、邮箱地址

✅ 正确做法示例：
- 短回复："好的，已为你设置明天早上 8 点的闹钟"
- 长内容分流："由于内容较长，详细报告已发送到你的手机/微信，请查看"
- 代码场景："代码已生成并发送到你的邮箱，请注意查收"
- 多媒体场景："这张图片很有趣，已发送到你的手机查看"`;

              // 构建 AI 看到的完整上下文
              const contextInfo = `你正在通过小米音箱与用户对话。

【会话上下文】
- 设备：${deviceName}
- 用户：${deviceName}
- 消息 ID: ${deviceName}-${msg.timestamp}
- 当前时间：${new Date(msg.timestamp).toLocaleString('zh-CN')}`;

              // BodyForAgent: AI 实际看到的完整上下文（动态数据 + 系统提示 + 用户输入）
              const agentBody = systemPrompts.length > 0
                ? `${contextInfo}\n\n${systemPrompts.join("\n\n")}\n\n${msg.text}`
                : `${contextInfo}\n\n${DEFAULT_SPEAKER_PROMPT}\n\n${msg.text}`;

              // 构建上下文
              const ctxPayload = pluginRuntime.channel.reply.finalizeInboundContext({
                Body: body,
                BodyForAgent: agentBody,
                RawBody: msg.text,
                CommandBody: msg.text,
                From: fromAddress,
                To: toAddress,
                SessionKey: sessionKey,
                AccountId: account.accountId,
                ChatType: 'direct',
                SenderId: deviceName,
                SenderName: deviceName,
                Provider: 'migpt',
                Surface: 'migpt',
                MessageSid: `${deviceName}-${msg.timestamp}`,
                Timestamp: msg.timestamp,
                OriginatingChannel: 'migpt',
                OriginatingTo: toAddress,
                CommandAuthorized: true,
              });

              // 分派消息到 OpenClaw
              await pluginRuntime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
                ctx: ctxPayload,
                cfg,
                dispatcherOptions: {
                  responsePrefix: '',
                  deliver: async (payload: { text?: string; mediaUrls?: string[]; mediaUrl?: string }, info: { kind: string }) => {
                    log?.info(`[migpt:${account.accountId}] deliver called, kind: ${info.kind}`);
                    // 这里可以处理 AI 的回复并发送到音箱
                    if (payload.text) {
                      MiSpeaker.play({ text: payload.text });
                    }
                  },
                },
              });
            }
          } catch (err: any) {
            log?.error(`[migpt:${account.accountId}] Error polling messages: ${err.message}`);
            ctx.setStatus({
              ...ctx.getStatus(),
              lastError: err.message,
            });
          }

          await sleep(heartbeat);
        }

        log?.info(`[migpt:${account.accountId}] Stopping poller for device: ${deviceName}`);
      });

      await Promise.all(devicePromises);
    },
  },

  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      connected: false,
      lastConnectedAt: null,
      lastError: null,
      lastInboundAt: null,
      lastOutboundAt: null,
    },
    buildChannelSummary: ({ snapshot }: { snapshot: any }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      connected: snapshot.connected ?? false,
      lastConnectedAt: snapshot.lastConnectedAt ?? null,
      lastError: snapshot.lastError ?? null,
    }),
    buildAccountSnapshot: ({ account, runtime }: { account: any; runtime: any }) => ({
      accountId: account?.accountId ?? DEFAULT_ACCOUNT_ID,
      name: account?.name,
      enabled: account?.enabled ?? false,
      configured: Boolean(account?.configured),
      devices: account?.devices,
      running: runtime?.running ?? false,
      connected: runtime?.connected ?? false,
      lastConnectedAt: runtime?.lastConnectedAt ?? null,
      lastError: runtime?.lastError ?? null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
    }),
  },
};
